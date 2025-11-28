import React from 'react';
import { MonitorConfig, PCStatus, CustomButton } from '../types';
import { StatusCard } from './StatusCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Zap, Power, Play, Monitor } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DashboardProps {
    config: MonitorConfig;
    statuses: Record<string, PCStatus>;
    buttonStates: Record<string, boolean>;
    onButtonClick: (btn: CustomButton) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ config, statuses, buttonStates, onButtonClick }) => {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {config.devices
                    .filter(device => config.monitoredDeviceIds.includes(device.id))
                    .map(device => {
                        const targetLogics = (config.logics || [])
                            .filter(l => l.enabled && l.targetIds.includes(device.id))
                            .map(l => {
                                const actionBtn = (config.customButtons || []).find(b => b.id === l.actionButtonId);
                                return {
                                    id: l.id,
                                    name: l.name,
                                    triggerStatus: l.triggerStatus,
                                    actionName: actionBtn ? actionBtn.label : 'Unknown Action'
                                };
                            });

                        return (
                            <StatusCard
                                key={device.id}
                                name={device.name}
                                ip={device.ip}
                                port={device.port}
                                status={statuses[device.id] || { lastResponse: 0, isAlive: true }}
                                logics={targetLogics}
                            />
                        );
                    })}
            </div>

            {config.customButtons && config.customButtons.length > 0 && (
                <div>
                    <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Zap className="w-5 h-5" />
                        Custom Actions
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {config.customButtons.map(btn => {
                            const isToggle = btn.mode === 'toggle';
                            const isOn = buttonStates[btn.id] || false;
                            const targetDevices = config.devices.filter(d => btn.deviceIds.includes(d.id));

                            return (
                                <Card key={btn.id} className="flex flex-col justify-between overflow-hidden">
                                    <CardHeader className="p-4 pb-2">
                                        <CardTitle className="text-base truncate" title={btn.label}>{btn.label}</CardTitle>
                                        {btn.description && (
                                            <CardDescription className="text-xs line-clamp-2" title={btn.description}>
                                                {btn.description}
                                            </CardDescription>
                                        )}
                                        {targetDevices.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {targetDevices.map(d => (
                                                    <Badge key={d.id} variant="secondary" className="text-xs font-normal flex items-center gap-1">
                                                        <Monitor className="w-3 h-3" />
                                                        {d.name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </CardHeader>
                                    <CardContent className="p-4 pt-2">
                                        <Button
                                            onClick={() => onButtonClick(btn)}
                                            variant={isToggle ? (isOn ? "default" : "outline") : "secondary"}
                                            className={cn(
                                                "w-full font-semibold transition-all gap-2",
                                                isToggle && isOn && "bg-green-600 hover:bg-green-700 text-white",
                                                !isToggle && isOn && "bg-primary/90 text-primary-foreground scale-95"
                                            )}
                                        >
                                            {isToggle ? (
                                                <>
                                                    <Power className="w-4 h-4" />
                                                    {isOn ? 'ON' : 'OFF'}
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="w-4 h-4" />
                                                    Run
                                                </>
                                            )}
                                        </Button>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
