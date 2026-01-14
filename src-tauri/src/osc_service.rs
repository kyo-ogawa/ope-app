use crate::models::{LogEntry, OscFlowEvent};
use rosc::{encoder, OscMessage, OscPacket, OscType};
use std::net::{SocketAddr, UdpSocket};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::mpsc;
use uuid::Uuid;

struct ListenerHandle {
    running: Arc<AtomicBool>,
    thread: JoinHandle<()>,
}

pub struct OscService {
    sender_socket: UdpSocket, // For sending
    listener: Option<ListenerHandle>,
}

impl OscService {
    pub fn new() -> Self {
        // Bind to ephemeral port for sending
        let sender_socket = UdpSocket::bind("0.0.0.0:0").expect("Failed to bind sender socket");
        sender_socket.set_nonblocking(true).ok();

        Self {
            sender_socket,
            listener: None,
        }
    }

    pub fn start_listener(
        &mut self, 
        port: u16, 
        tx: mpsc::Sender<(String, Vec<OscType>, SocketAddr)>,
        log_tx: mpsc::Sender<LogEntry>,
        flow_tx: mpsc::Sender<OscFlowEvent>,
        local_ip: String,
    ) {
        // Each listener gets its own running flag
        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();
        
        let handle = thread::spawn(move || {
            let socket = match UdpSocket::bind(format!("0.0.0.0:{}", port)) {
                Ok(s) => s,
                Err(e) => {
                    let _ = log_tx.blocking_send(LogEntry {
                        timestamp: current_timestamp(),
                        level: "error".to_string(),
                        message: format!("Failed to bind OSC listener to port {}: {}", port, e),
                    });
                    eprintln!("Failed to bind OSC listener to port {}: {}", port, e);
                    return;
                }
            };
            
            // Set read timeout so we can check 'running' flag
            socket.set_read_timeout(Some(Duration::from_millis(500))).ok();

            let mut buf = [0u8; 65535];

            while running_clone.load(Ordering::SeqCst) {
                match socket.recv_from(&mut buf) {
                    Ok((size, addr)) => {
                        let packet = &buf[..size];
                        match rosc::decoder::decode_udp(packet) {
                            Ok((_, packet)) => {
                                handle_packet(packet, addr, port, &local_ip, &tx, &log_tx, &flow_tx);
                            }
                            Err(e) => {
                                let _ = log_tx.blocking_send(LogEntry {
                                    timestamp: current_timestamp(),
                                    level: "error".to_string(),
                                    message: format!("Error decoding OSC packet: {}", e),
                                });
                                eprintln!("Error decoding OSC packet: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        // Timeout is expected
                        if e.kind() != std::io::ErrorKind::WouldBlock && e.kind() != std::io::ErrorKind::TimedOut {
                            let _ = log_tx.blocking_send(LogEntry {
                                timestamp: current_timestamp(),
                                level: "error".to_string(),
                                message: format!("Error receiving OSC packet: {}", e),
                            });
                            eprintln!("Error receiving OSC packet: {}", e);
                        }
                    }
                }
            }
        });
        
        self.listener = Some(ListenerHandle { running, thread: handle });
    }

    pub fn stop_listener(&mut self) {
        // Take the listener handle if it exists
        let listener = match self.listener.take() {
            Some(l) => l,
            None => return,
        };
        
        // Signal this specific listener to stop
        listener.running.store(false, Ordering::SeqCst);
        
        // Wait for the listener thread to finish (with timeout)
        // The thread should exit within ~500ms due to socket read timeout
        let timeout = Duration::from_secs(1);
        let start = std::time::Instant::now();
        
        while !listener.thread.is_finished() {
            if start.elapsed() > timeout {
                eprintln!("Warning: OSC listener thread did not stop within timeout");
                return;
            }
            thread::sleep(Duration::from_millis(100));
        }
        
        // Join the thread
        let _ = listener.thread.join();
    }

    pub fn send(
        &self, 
        ip: &str, 
        port: u16, 
        address: &str, 
        args: Vec<OscType>, 
        log_tx: Option<&mpsc::Sender<LogEntry>>,
        flow_tx: Option<&mpsc::Sender<OscFlowEvent>>,
        local_ip: &str,
    ) {
        let addr = format!("{}:{}", ip, port);
        let msg = OscMessage {
            addr: address.to_string(),
            args: args.clone(),
        };
        let packet = OscPacket::Message(msg);
        
        match encoder::encode(&packet) {
            Ok(buf) => {
                // Get the local port from sender socket
                let local_port = self.sender_socket.local_addr().map(|a| a.port()).unwrap_or(0);
                
                if let Err(e) = self.sender_socket.send_to(&buf, &addr) {
                    if let Some(tx) = log_tx {
                        let _ = tx.blocking_send(LogEntry {
                            timestamp: current_timestamp(),
                            level: "error".to_string(),
                            message: format!("Failed to send OSC to {}: {}", addr, e),
                        });
                    }
                    eprintln!("Failed to send OSC to {}: {}", addr, e);
                } else {
                    let args_str = args.iter().map(|a| format!("{:?}", a)).collect::<Vec<_>>().join(", ");
                    
                    if let Some(tx) = log_tx {
                        let _ = tx.blocking_send(LogEntry {
                            timestamp: current_timestamp(),
                            level: "tx".to_string(),
                            message: format!("Sent to {}: {} [{}]", addr, address, args_str),
                        });
                    }
                    
                    // Emit flow event
                    if let Some(ftx) = flow_tx {
                        let _ = ftx.blocking_send(OscFlowEvent {
                            id: Uuid::new_v4().to_string(),
                            timestamp: current_timestamp(),
                            direction: "tx".to_string(),
                            source_ip: local_ip.to_string(),
                            source_port: local_port,
                            dest_ip: ip.to_string(),
                            dest_port: port,
                            address: address.to_string(),
                            args: args_str,
                        });
                    }
                }
            }
            Err(e) => {
                if let Some(tx) = log_tx {
                    let _ = tx.blocking_send(LogEntry {
                        timestamp: current_timestamp(),
                        level: "error".to_string(),
                        message: format!("Failed to encode OSC packet: {}", e),
                    });
                }
                eprintln!("Failed to encode OSC packet: {}", e);
            }
        }
    }
}

fn handle_packet(
    packet: OscPacket, 
    addr: SocketAddr,
    local_port: u16,
    local_ip: &str,
    tx: &mpsc::Sender<(String, Vec<OscType>, SocketAddr)>,
    log_tx: &mpsc::Sender<LogEntry>,
    flow_tx: &mpsc::Sender<OscFlowEvent>,
) {
    match packet {
        OscPacket::Message(msg) => {
            // Log RX
            let args_str = msg.args.iter().map(|a| format!("{:?}", a)).collect::<Vec<_>>().join(", ");
            let _ = log_tx.blocking_send(LogEntry {
                timestamp: current_timestamp(),
                level: "rx".to_string(),
                message: format!("Received from {}: {} [{}]", addr, msg.addr, args_str),
            });

            // Emit flow event
            let _ = flow_tx.blocking_send(OscFlowEvent {
                id: Uuid::new_v4().to_string(),
                timestamp: current_timestamp(),
                direction: "rx".to_string(),
                source_ip: addr.ip().to_string(),
                source_port: addr.port(),
                dest_ip: local_ip.to_string(),
                dest_port: local_port,
                address: msg.addr.clone(),
                args: args_str,
            });

            // Forward to channel
            let _ = tx.blocking_send((msg.addr, msg.args, addr));
        }
        OscPacket::Bundle(bundle) => {
            for packet in bundle.content {
                handle_packet(packet, addr, local_port, local_ip, tx, log_tx, flow_tx);
            }
        }
    }
}

fn current_timestamp() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64
}

