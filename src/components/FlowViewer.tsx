import { useState, useEffect, useCallback, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2 } from "lucide-react";
import { OscFlowEvent, MonitorConfig } from '@/types';

interface Props {
  config: MonitorConfig;
}

interface DeviceNode {
  id: string;
  name: string;
  ip: string;
  port: number;
  isApp: boolean;
}

interface ActiveFlow {
  key: string;
  sourceIdx: number;
  destIdx: number;
  address: string;
  args: string;
  direction: 'tx' | 'rx';
  timestamp: number;
}

interface RecentMessage {
  id: string;
  sourceIdx: number;
  destIdx: number;
  address: string;
  args: string;
  direction: 'tx' | 'rx';
  timestamp: number;
}

interface FlowRow {
  key: string;
  address: string;
  deviceIdx: number;
  direction: 'tx' | 'rx';
}

export function FlowViewer({ config }: Props) {
  const [localIps, setLocalIps] = useState<string[]>([]);
  const [activeFlows, setActiveFlows] = useState<Map<string, ActiveFlow>>(new Map());
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);

  useEffect(() => {
    invoke<string[]>('get_local_ip').then((ips) => {
      setLocalIps(ips);
    }).catch(console.error);
  }, []);

  const devices = useMemo<DeviceNode[]>(() => {
    const result: DeviceNode[] = [];

    result.push({
      id: 'app',
      name: 'App',
      ip: localIps[0] || '',
      port: config.localPort,
      isApp: true,
    });

    config.devices.forEach(device => {
      result.push({
        id: device.id,
        name: device.name,
        ip: device.ip,
        port: device.port,
        isApp: false,
      });
    });

    return result;
  }, [config.devices, localIps, config.localPort]);

  const findDeviceIndex = useCallback((ip: string): number => {
    if (localIps.includes(ip)) return 0;
    const idx = devices.findIndex(d => d.ip === ip);
    return idx >= 0 ? idx : -1;
  }, [devices, localIps]);

  const getFlowKey = useCallback((sourceIdx: number, destIdx: number, address: string) => {
    return `${sourceIdx}->${destIdx}:${address}`;
  }, []);

  const getRowKey = useCallback((direction: 'tx' | 'rx', deviceIdx: number, address: string) => {
    return `${direction}:${deviceIdx}:${address}`;
  }, []);

  const handleFlowEvent = useCallback((flow: OscFlowEvent) => {
    const sourceIdx = findDeviceIndex(flow.sourceIp);
    const destIdx = findDeviceIndex(flow.destIp);

    if (sourceIdx === -1 || destIdx === -1) return;

    const flowKey = getFlowKey(sourceIdx, destIdx, flow.address);

    setActiveFlows(prev => {
      const newMap = new Map(prev);
      newMap.set(flowKey, {
        key: flowKey,
        sourceIdx,
        destIdx,
        address: flow.address,
        args: flow.args,
        direction: flow.direction as 'tx' | 'rx',
        timestamp: flow.timestamp,
      });
      return newMap;
    });

    setRecentMessages(prev => [
      {
        id: flow.id,
        sourceIdx,
        destIdx,
        address: flow.address,
        args: flow.args,
        direction: flow.direction as 'tx' | 'rx',
        timestamp: flow.timestamp,
      },
      ...prev.slice(0, 49),
    ]);

    setTimeout(() => {
      setActiveFlows(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(flowKey);
        if (current && current.timestamp === flow.timestamp) {
          newMap.delete(flowKey);
        }
        return newMap;
      });
    }, 1500);
  }, [findDeviceIndex, getFlowKey]);

  useEffect(() => {
    const unlisten = listen<OscFlowEvent>('osc-flow', (event) => {
      handleFlowEvent(event.payload);
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [handleFlowEvent]);

  const { txRows, rxRows } = useMemo(() => {
    const txMap = new Map<string, FlowRow>();
    const rxMap = new Map<string, FlowRow>();

    activeFlows.forEach(flow => {
      if (flow.direction === 'tx' || flow.sourceIdx === 0) {
        const rowKey = getRowKey('tx', flow.destIdx, flow.address);
        txMap.set(rowKey, {
          key: rowKey,
          address: flow.address,
          deviceIdx: flow.destIdx,
          direction: 'tx',
        });
      } else {
        const rowKey = getRowKey('rx', flow.sourceIdx, flow.address);
        rxMap.set(rowKey, {
          key: rowKey,
          address: flow.address,
          deviceIdx: flow.sourceIdx,
          direction: 'rx',
        });
      }
    });

    recentMessages.slice(0, 30).forEach(msg => {
      if (msg.direction === 'tx' || msg.sourceIdx === 0) {
        const rowKey = getRowKey('tx', msg.destIdx, msg.address);
        if (!txMap.has(rowKey)) {
          txMap.set(rowKey, {
            key: rowKey,
            address: msg.address,
            deviceIdx: msg.destIdx,
            direction: 'tx',
          });
        }
      } else {
        const rowKey = getRowKey('rx', msg.sourceIdx, msg.address);
        if (!rxMap.has(rowKey)) {
          rxMap.set(rowKey, {
            key: rowKey,
            address: msg.address,
            deviceIdx: msg.sourceIdx,
            direction: 'rx',
          });
        }
      }
    });

    const sortRows = (rows: FlowRow[]) => 
      rows.sort((a, b) => {
        const addrCompare = a.address.localeCompare(b.address);
        if (addrCompare !== 0) return addrCompare;
        return a.deviceIdx - b.deviceIdx;
      });

    return {
      txRows: sortRows(Array.from(txMap.values())),
      rxRows: sortRows(Array.from(rxMap.values())),
    };
  }, [activeFlows, recentMessages, getRowKey]);

  const clearAll = () => {
    setActiveFlows(new Map());
    setRecentMessages([]);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
    });
  };

  const COLUMN_WIDTH = 160;
  const ROW_HEIGHT = 36;
  const HEADER_PADDING = 16;

  const txRowCount = Math.max(0, txRows.length);
  const rxRowCount = Math.max(0, rxRows.length);
  const totalRows = txRowCount + rxRowCount;
  const DIAGRAM_HEIGHT = totalRows > 0 
    ? HEADER_PADDING + totalRows * ROW_HEIGHT + HEADER_PADDING 
    : 120;

  const otherDevices = devices.filter(d => !d.isApp);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono">
            {recentMessages.length} messages
          </Badge>
          <Badge variant="outline" className="font-mono">
            {txRows.length + rxRows.length} connections
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={clearAll}>
          <Trash2 className="w-4 h-4 mr-1" />
          Clear
        </Button>
      </div>

      {/* Sequence Diagram */}
      <div className="border rounded-lg bg-background overflow-x-auto">
        <div style={{ minWidth: devices.length * COLUMN_WIDTH }}>
          {/* Device Headers */}
          <div className="flex border-b bg-muted/30">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex-shrink-0 p-3 text-center"
                style={{ width: COLUMN_WIDTH }}
              >
                <div className={`
                  inline-block px-3 py-2 rounded-lg border-2 transition-all duration-300
                  ${device.isApp ? 'bg-primary/10 border-primary' : 'bg-muted border-muted-foreground/30'}
                `}>
                  <div className="font-semibold text-sm">{device.name}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    {device.ip || '—'}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    Port: {device.port}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Flow Area */}
          <div 
            className="relative"
            style={{ height: DIAGRAM_HEIGHT }}
          >
            <svg 
              className="absolute inset-0 w-full h-full"
              style={{ minWidth: devices.length * COLUMN_WIDTH }}
            >
              <defs>
                <filter id="glow-tx" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <filter id="glow-rx" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>

                {/* Arrow markers - fixed size */}
                <marker id="arrow-tx" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <polygon points="0,0 8,4 0,8" fill="#10b981" />
                </marker>
                <marker id="arrow-rx" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <polygon points="0,0 8,4 0,8" fill="#3b82f6" />
                </marker>
                <marker id="arrow-gray" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <polygon points="0,0 8,4 0,8" fill="#9ca3af" />
                </marker>
                <marker id="arrow-gray-left" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <polygon points="0,0 8,4 0,8" fill="#9ca3af" />
                </marker>
              </defs>

              {/* Vertical Lifelines */}
              {devices.map((device, idx) => {
                const x = idx * COLUMN_WIDTH + COLUMN_WIDTH / 2;
                return (
                  <line
                    key={`lifeline-${device.id}`}
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={DIAGRAM_HEIGHT}
                    stroke={device.isApp ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                    strokeWidth={device.isApp ? 2 : 1}
                    strokeDasharray={device.isApp ? 'none' : '8 4'}
                    opacity={device.isApp ? 0.5 : 0.25}
                  />
                );
              })}

              {/* TX Rows */}
              {txRows.map((row, rowIdx) => {
                const y = HEADER_PADDING + rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                const sourceIdx = 0;
                const destIdx = row.deviceIdx;
                const sourceX = sourceIdx * COLUMN_WIDTH + COLUMN_WIDTH / 2;
                const destX = destIdx * COLUMN_WIDTH + COLUMN_WIDTH / 2;
                const flowKey = getFlowKey(sourceIdx, destIdx, row.address);
                const isActive = activeFlows.has(flowKey);

                const color = isActive ? "#10b981" : "#9ca3af";
                const opacity = isActive ? 1 : 0.4;
                const arrowX = destX - 8;

                return (
                  <g key={`tx-${row.key}`} opacity={opacity}>
                    {/* Start circle */}
                    <circle cx={sourceX} cy={y} r={4} fill={color} />
                    {/* Line */}
                    <line
                      x1={sourceX + 6}
                      y1={y}
                      x2={arrowX}
                      y2={y}
                      stroke={color}
                      strokeWidth={2}
                    />
                    {/* Arrow head */}
                    <polygon 
                      points={`${arrowX},${y-5} ${arrowX+10},${y} ${arrowX},${y+5}`}
                      fill={color}
                    />
                    {/* End circle */}
                    <circle cx={destX} cy={y} r={3} fill="none" stroke={color} strokeWidth={2} />
                  </g>
                );
              })}

              {/* RX Rows (Device -> App) */}
              {rxRows.map((row, rowIdx) => {
                const y = HEADER_PADDING + txRowCount * ROW_HEIGHT + rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                const deviceIdx = row.deviceIdx;
                const appIdx = 0;
                const deviceX = deviceIdx * COLUMN_WIDTH + COLUMN_WIDTH / 2;
                const appX = appIdx * COLUMN_WIDTH + COLUMN_WIDTH / 2;
                const flowKey = getFlowKey(deviceIdx, appIdx, row.address);
                const isActive = activeFlows.has(flowKey);

                const color = isActive ? "#3b82f6" : "#9ca3af";
                const opacity = isActive ? 1 : 0.4;
                const arrowX = appX + 8;

                return (
                  <g key={`rx-${row.key}`} opacity={opacity}>
                    {/* Start circle (Device side) */}
                    <circle cx={deviceX} cy={y} r={4} fill={color} />
                    {/* Line */}
                    <line
                      x1={deviceX - 6}
                      y1={y}
                      x2={arrowX}
                      y2={y}
                      stroke={color}
                      strokeWidth={2}
                    />
                    {/* Arrow head (pointing left to App) */}
                    <polygon 
                      points={`${arrowX},${y-5} ${arrowX-10},${y} ${arrowX},${y+5}`}
                      fill={color}
                    />
                    {/* End circle (App side) */}
                    <circle cx={appX} cy={y} r={3} fill="none" stroke={color} strokeWidth={2} />
                  </g>
                );
              })}
            </svg>

            {/* TX Labels */}
            {txRows.map((row, rowIdx) => {
              const y = HEADER_PADDING + rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
              const flowKey = getFlowKey(0, row.deviceIdx, row.address);
              const isActive = activeFlows.has(flowKey);

              return (
                <div
                  key={`tx-label-${row.key}`}
                  className={`
                    absolute text-xs font-mono whitespace-nowrap px-2 py-0.5 rounded
                    transition-all duration-200 pointer-events-none
                    ${isActive 
                      ? 'bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-semibold scale-105' 
                      : 'text-muted-foreground/60'
                    }
                  `}
                  style={{
                    left: 12,
                    top: y - 10,
                  }}
                >
                  {row.address}
                </div>
              );
            })}

            {/* RX Labels */}
            {rxRows.map((row, rowIdx) => {
              const y = HEADER_PADDING + txRowCount * ROW_HEIGHT + rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
              const flowKey = getFlowKey(row.deviceIdx, 0, row.address);
              const isActive = activeFlows.has(flowKey);

              return (
                <div
                  key={`rx-label-${row.key}`}
                  className={`
                    absolute text-xs font-mono whitespace-nowrap px-2 py-0.5 rounded
                    transition-all duration-200 pointer-events-none
                    ${isActive 
                      ? 'bg-blue-500/25 text-blue-600 dark:text-blue-400 font-semibold scale-105' 
                      : 'text-muted-foreground/60'
                    }
                  `}
                  style={{
                    left: 12,
                    top: y - 10,
                  }}
                >
                  {row.address}
                </div>
              );
            })}

            {/* Divider between TX and RX */}
            {txRows.length > 0 && rxRows.length > 0 && (
              <div
                className="absolute left-4 right-4 border-t border-dashed border-muted-foreground/20"
                style={{ top: HEADER_PADDING + txRowCount * ROW_HEIGHT - 2 }}
              />
            )}

            {/* Empty state */}
            {totalRows === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                {otherDevices.length === 0 
                  ? 'No devices configured'
                  : 'Waiting for OSC messages...'
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Messages List */}
      <div className="border rounded-lg">
        <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
          <span className="text-sm font-medium">Recent Messages</span>
          <Badge variant="outline" className="text-xs">
            {recentMessages.length}
          </Badge>
        </div>
        <ScrollArea className="h-[140px]">
          {recentMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Waiting for OSC messages...
            </div>
          ) : (
            <div className="divide-y">
              {recentMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="px-4 py-1.5 flex items-center gap-3 text-xs hover:bg-muted/30"
                >
                  <span className="text-muted-foreground font-mono w-16 flex-shrink-0">
                    {formatTime(msg.timestamp)}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-xs w-7 justify-center flex-shrink-0 ${
                      msg.direction === 'tx'
                        ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
                        : 'border-blue-500/50 text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {msg.direction.toUpperCase()}
                  </Badge>
                  <span className="text-muted-foreground flex-shrink-0 w-28 truncate">
                    {devices[msg.sourceIdx]?.name} → {devices[msg.destIdx]?.name}
                  </span>
                  <code className="font-semibold">{msg.address}</code>
                  {msg.args && (
                    <span className="text-muted-foreground truncate">
                      [{msg.args}]
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <div className="w-4 h-0.5 bg-emerald-500" />
            <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
          </div>
          <span>TX (送信)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <div className="w-4 h-0.5 bg-blue-500" />
            <div className="w-2 h-2 rounded-full bg-blue-500/50" />
          </div>
          <span>RX (受信)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-gray-400/50" />
            <div className="w-4 h-0.5 bg-gray-400/30" />
            <div className="w-2 h-2 rounded-full border border-gray-400/50" />
          </div>
          <span>Idle</span>
        </div>
      </div>
    </div>
  );
}
