import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PCStatus, LogicInfo, CustomMonitor, MonitorValue } from '../types';
import { Monitor, CheckCircle2, XCircle, ArrowRight, Activity, Radio } from 'lucide-react';

interface StatusCardProps {
    name: string;
    ip: string;
    port: number;
    status: PCStatus;
    logics?: LogicInfo[];
    monitors?: CustomMonitor[];
    monitorValues?: Record<string, MonitorValue>;
}

export const StatusCard: React.FC<StatusCardProps> = ({ name, ip, port, status, logics, monitors, monitorValues }) => {
    const isAlive = status.isAlive;

    const lastResponseTime = status.lastResponse > 0
        ? new Date(status.lastResponse).toLocaleTimeString()
        : 'Never';

    return (
        <Card className={cn(
            "transition-all duration-300 border-l-4",
            isAlive ? "border-l-green-500" : "border-l-destructive shadow-md shadow-destructive/10"
        )}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{name}</CardTitle>
                </div>
                {isAlive ? (
                    <div className="flex items-center gap-1 text-green-600 bg-green-100 px-2 py-1 rounded-full text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        ONLINE
                    </div>
                ) : (
                    <div className="flex items-center gap-1 text-destructive bg-destructive/10 px-2 py-1 rounded-full text-xs font-medium animate-pulse">
                        <XCircle className="w-3 h-3" />
                        OFFLINE
                    </div>
                )}
            </CardHeader>
            <CardContent>
                <div className="text-sm text-muted-foreground mb-4 space-y-1">
                    <div className="flex justify-between">
                        <span>Address:</span>
                        <span className="font-mono">{ip}:{port}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Last Response:</span>
                        <span>{lastResponseTime}</span>
                    </div>
                </div>

                {/* Custom Monitors */}
                {monitors && monitors.length > 0 && (
                    <div className="pt-2 border-t mb-4">
                        <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                            <Radio className="w-3 h-3" />
                            Monitors
                        </div>
                        <div className="space-y-2">
                            {monitors.map(monitor => {
                                const value = monitorValues?.[monitor.id];
                                const hasValue = value && value.args.length > 0;
                                const lastUpdated = value?.lastUpdated 
                                    ? new Date(value.lastUpdated).toLocaleTimeString()
                                    : null;

                                return (
                                    <div key={monitor.id} className="text-sm bg-muted/30 p-2 rounded">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-medium text-xs text-muted-foreground">{monitor.name}</span>
                                            {lastUpdated && (
                                                <span className="text-xs text-muted-foreground/60">{lastUpdated}</span>
                                            )}
                                        </div>
                                        {hasValue ? (
                                            <div className="flex flex-wrap gap-2">
                                                {value.args.map((argVal, i) => {
                                                    const argDef = monitor.args[i];
                                                    return (
                                                        <div 
                                                            key={i} 
                                                            className={cn(
                                                                "flex items-center gap-1 px-2 py-1 rounded text-sm font-mono",
                                                                argVal.status === 'normal' && "bg-muted",
                                                                argVal.status === 'warning' && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
                                                                argVal.status === 'critical' && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 animate-pulse"
                                                            )}
                                                            title={`${argDef?.name || 'Value'}: ${argVal.displayValue}`}
                                                        >
                                                            {argDef && argDef.name !== 'Value' && (
                                                                <span className="text-xs text-muted-foreground font-normal">{argDef.name}:</span>
                                                            )}
                                                            <span className="font-semibold">{argVal.displayValue}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-muted-foreground/50 italic">
                                                Waiting for data...
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {logics && logics.length > 0 && (
                    <div className="pt-2 border-t">
                        <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            Active Logics
                        </div>
                        <div className="space-y-1">
                            {logics.map(logic => (
                                <div key={logic.id} className="text-xs flex items-center gap-2 bg-muted/50 p-1.5 rounded">
                                    <span className={cn(
                                        "font-bold px-1 rounded",
                                        logic.triggerStatus === 'offline' ? "text-destructive bg-destructive/10" : "text-green-600 bg-green-100"
                                    )}>
                                        {logic.triggerStatus === 'offline' ? 'DOWN' : 'UP'}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                    <span className="truncate">{logic.actionName}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
