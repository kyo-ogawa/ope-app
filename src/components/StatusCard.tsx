import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PCStatus, LogicInfo } from '../types';
import { Monitor, CheckCircle2, XCircle, ArrowRight, Activity } from 'lucide-react';

// I'll use custom styling for status indicator to match original feel but cleaner
// Or I can install badge. Let's stick to standard HTML/Tailwind for custom indicators if Badge is not installed.
// I'll check if I installed badge. I didn't. I'll use Tailwind classes.

interface StatusCardProps {
    name: string;
    ip: string;
    port: number;
    status: PCStatus;
    logics?: LogicInfo[];
}

export const StatusCard: React.FC<StatusCardProps> = ({ name, ip, port, status, logics }) => {
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
