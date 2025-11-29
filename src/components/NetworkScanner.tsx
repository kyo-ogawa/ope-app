import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { NetworkInterface, ScannedDevice, ScanProgress } from '../types';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, StopCircle, Copy, CheckCheck } from "lucide-react";

interface NetworkScannerProps {
  onAddDevice?: (ip: string, name: string) => void;
}

interface AddressStatus {
  ip: string;
  index: number;
  isReachable: boolean;
  hostname: string | null;
  responseTimeMs: number | null;
  isScanned: boolean;
}

export function NetworkScanner({ onAddDevice }: NetworkScannerProps) {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<string>('');
  const [scanRange, setScanRange] = useState({ start: 1, end: 254 });
  const [timeout, setTimeout] = useState(500);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [addressMap, setAddressMap] = useState<Map<number, AddressStatus>>(new Map());
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<AddressStatus | null>(null);
  const startTimeRef = useRef<number>(0);
  const [lastScanTime, setLastScanTime] = useState<number | null>(null);

  useEffect(() => {
    // Load network interfaces
    invoke<NetworkInterface[]>('get_interfaces').then((ifaces) => {
      setInterfaces(ifaces);
      if (ifaces.length > 0) {
        setSelectedInterface(ifaces[0].ip);
      }
    });

    // Listen for scan progress
    const unlistenProgress = listen<ScanProgress>('scan-progress', (event) => {
      setProgress(event.payload);
    });

    // Listen for device found
    const unlistenDevice = listen<ScannedDevice>('device-found', (event) => {
      const device = event.payload;
      const index = parseInt(device.ip.split('.').pop() || '0');
      setAddressMap(prev => {
        const newMap = new Map(prev);
        newMap.set(index, {
          ip: device.ip,
          index,
          isReachable: true,
          hostname: device.hostname,
          responseTimeMs: device.responseTimeMs,
          isScanned: true,
        });
        return newMap;
      });
    });

    // Listen for scan completion
    const unlistenComplete = listen('scan-complete', () => {
      setIsScanning(false);
      setProgress(null);
      setLastScanTime(Date.now() - startTimeRef.current);
    });

    return () => {
      unlistenProgress.then(f => f());
      unlistenDevice.then(f => f());
      unlistenComplete.then(f => f());
    };
  }, []);

  const handleScan = async () => {
    if (!selectedInterface) return;

    setIsScanning(true);
    startTimeRef.current = Date.now();
    
    // Initialize address map with all addresses as not scanned
    const octets = selectedInterface.split('.');
    const baseIp = `${octets[0]}.${octets[1]}.${octets[2]}`;
    const newMap = new Map<number, AddressStatus>();
    for (let i = scanRange.start; i <= scanRange.end; i++) {
      newMap.set(i, {
        ip: `${baseIp}.${i}`,
        index: i,
        isReachable: false,
        hostname: null,
        responseTimeMs: null,
        isScanned: false,
      });
    }
    setAddressMap(newMap);

    try {
      await invoke('scan_network_range', {
        baseIp,
        start: scanRange.start,
        end: scanRange.end,
        timeoutMs: timeout,
      });
    } catch (error) {
      console.error('Scan failed:', error);
      setIsScanning(false);
      setProgress(null);
    }
  };

  const handleStopScan = async () => {
    try {
      await invoke('stop_scan');
    } catch (error) {
      console.error('Stop scan failed:', error);
    }
  };

  const handleCopyIp = async (ip: string) => {
    await navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    window.setTimeout(() => setCopiedIp(null), 2000);
  };

  const progressPercent = progress ? Math.round((progress.current / progress.total) * 100) : 0;
  const reachableCount = Array.from(addressMap.values()).filter(a => a.isReachable).length;

  // Generate all addresses in range
  const addresses = [];
  for (let i = scanRange.start; i <= scanRange.end; i++) {
    addresses.push(addressMap.get(i) || {
      ip: '',
      index: i,
      isReachable: false,
      hostname: null,
      responseTimeMs: null,
      isScanned: false,
    });
  }

  return (
    <div className="space-y-4">
      {/* Scan Configuration */}
      <Card className="border-dashed">
        <CardHeader className="py-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-4">
              <Select value={selectedInterface} onValueChange={setSelectedInterface}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="インターフェース" />
                </SelectTrigger>
                <SelectContent>
                  {interfaces.map((iface) => (
                    <SelectItem key={iface.ip} value={iface.ip}>
                      {iface.name} ({iface.ip})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 text-sm">
                <Label className="text-muted-foreground">範囲:</Label>
                <Input
                  type="number"
                  value={scanRange.start}
                  onChange={(e) => setScanRange(prev => ({ ...prev, start: Number(e.target.value) }))}
                  min={1}
                  max={254}
                  className="w-16 h-8"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  value={scanRange.end}
                  onChange={(e) => setScanRange(prev => ({ ...prev, end: Number(e.target.value) }))}
                  min={1}
                  max={254}
                  className="w-16 h-8"
                />
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Label className="text-muted-foreground">Timeout:</Label>
                <Input
                  type="number"
                  value={timeout}
                  onChange={(e) => setTimeout(Number(e.target.value))}
                  min={100}
                  max={5000}
                  step={100}
                  className="w-20 h-8"
                />
                <span className="text-muted-foreground text-xs">ms</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isScanning ? (
                <Button
                  onClick={handleStopScan}
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                >
                  <StopCircle className="w-4 h-4" />
                  停止
                </Button>
              ) : (
                <Button
                  onClick={handleScan}
                  disabled={!selectedInterface}
                  size="sm"
                  className="gap-2"
                >
                  <Search className="w-4 h-4" />
                  スキャン
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Progress bar */}
      {isScanning && progress && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>スキャン中: {progress.currentIp}</span>
            <span>{progressPercent}% ({reachableCount}台検出)</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Status bar */}
      {!isScanning && addressMap.size > 0 && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-green-500" />
            使用中: {reachableCount}台
          </span>
          <span className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-slate-800" />
            未使用: {addressMap.size - reachableCount}台
          </span>
          {lastScanTime && (
            <span className="ml-auto">
              スキャン時間: {(lastScanTime / 1000).toFixed(1)}秒
            </span>
          )}
        </div>
      )}

      {/* IP Grid - igping style */}
      <Card className="bg-slate-950 border-slate-800">
        <CardContent className="p-2">
          <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {addresses.map((addr) => (
              <div
                key={addr.index}
                onClick={() => addr.isReachable && setSelectedAddress(addr)}
                className={`
                  flex items-center gap-2 px-2 py-1 rounded-sm cursor-pointer transition-all text-xs font-mono
                  ${addr.isReachable 
                    ? 'bg-green-500/90 text-green-950 hover:bg-green-400' 
                    : 'bg-slate-900 text-slate-600 hover:bg-slate-800'
                  }
                  ${selectedAddress?.index === addr.index ? 'ring-2 ring-white' : ''}
                `}
              >
                <span className="w-7 text-right opacity-70">{addr.index}</span>
                <span className="flex-1 truncate">
                  {addr.isReachable 
                    ? (addr.hostname || '-')
                    : '—'}
                </span>
                {addr.isReachable && addr.responseTimeMs !== null && (
                  <span className="opacity-60 shrink-0">{addr.responseTimeMs}ms</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected device detail */}
      {selectedAddress && selectedAddress.isReachable && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <code className="text-lg font-mono font-bold">{selectedAddress.ip}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleCopyIp(selectedAddress.ip)}
                  >
                    {copiedIp === selectedAddress.ip ? (
                      <CheckCheck className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                {selectedAddress.hostname && (
                  <p className="text-sm text-muted-foreground">{selectedAddress.hostname}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedAddress.responseTimeMs !== null && (
                  <span className="text-sm text-muted-foreground">
                    応答時間: {selectedAddress.responseTimeMs}ms
                  </span>
                )}
                {onAddDevice && (
                  <Button
                    size="sm"
                    onClick={() => onAddDevice(selectedAddress.ip, selectedAddress.hostname || selectedAddress.ip)}
                  >
                    デバイスに追加
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
