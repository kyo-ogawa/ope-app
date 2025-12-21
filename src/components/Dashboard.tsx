import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MonitorConfig, PCStatus, CustomButton, MonitorValue } from '../types';
import { StatusCard } from './StatusCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Zap, Power, Play, Pause, Monitor, Timer, Sliders } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DashboardProps {
    config: MonitorConfig;
    statuses: Record<string, PCStatus>;
    buttonStates: Record<string, boolean>;
    buttonLastTriggered: Record<string, number>;
    onButtonClick: (btn: CustomButton) => void;
    onValueChange?: (btn: CustomButton, value: number) => void;
    monitorValues?: Record<string, Record<string, MonitorValue>>;
}

const PeriodicButtonProgress: React.FC<{ interval: number; lastTriggered: number }> = ({ interval, lastTriggered }) => {
    const [progress, setProgress] = useState(0);
    const [remaining, setRemaining] = useState(0);

    useEffect(() => {
        // Use lastTriggered from backend, or current time for initial display
        const effectiveTime = lastTriggered > 0 ? lastTriggered : Date.now();

        // console.log('🔄 PeriodicButtonProgress RESET:', { 
        //     interval: interval + 'ms', 
        //     lastTriggered: effectiveTime, 
        //     time: new Date(effectiveTime).toLocaleTimeString(),
        //     isInitial: lastTriggered === 0
        // });

        if (interval <= 0) {
            setProgress(0);
            setRemaining(0);
            return;
        }

        let animationId: number;
        let lastLoggedProgress = -1;
        const update = () => {
            const now = Date.now();
            const elapsed = now - effectiveTime;
            const p = Math.min(100, (elapsed / interval) * 100);
            const remainingSec = Math.max(0, Math.ceil((interval - elapsed) / 1000));

            // Log only when progress changes significantly
            const currentProgress = Math.floor(p / 10) * 10;
            if (currentProgress !== lastLoggedProgress) {
                console.log('Progress:', {
                    progress: Math.floor(p) + '%',
                    barWidth: (100 - p) + '%',
                    remaining: remainingSec + 's'
                });
                lastLoggedProgress = currentProgress;
            }

            setProgress(p);
            setRemaining(remainingSec);

            // Continue animation loop
            animationId = requestAnimationFrame(update);
        };

        animationId = requestAnimationFrame(update);
        return () => cancelAnimationFrame(animationId);
    }, [lastTriggered, interval]);

    return (
        <>
            <div className="absolute bottom-0 left-0 h-3 bg-gray-200 dark:bg-gray-700 w-full overflow-hidden rounded-b-lg">
                <div
                    className="h-full bg-blue-500"
                    style={{ width: `${100 - progress}%` }}
                />
            </div>
            <div className="absolute bottom-4 right-2 text-xs text-foreground font-mono bg-background/90 px-2 py-0.5 rounded shadow-md border">
                {remaining}s
            </div>
        </>
    );
};

interface ValueButtonControlProps {
    btn: CustomButton;
    onValueChange: (value: number) => void;
}

const ValueButtonControl: React.FC<ValueButtonControlProps> = ({ btn, onValueChange }) => {
    const hasRange = btn.valueMin !== undefined && btn.valueMax !== undefined;
    const min = btn.valueMin ?? 0;
    const max = btn.valueMax ?? 100;
    const step = btn.valueStep ?? (btn.valueType === 'int' ? 1 : 0.1);
    const defaultValue = btn.valueDefault ?? min;
    
    const [inputValue, setInputValue] = useState<string>(String(defaultValue));
    const [sliderValue, setSliderValue] = useState<number>(defaultValue);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    
    // テキスト入力時のデバウンス送信
    const debouncedSend = useCallback((value: number) => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            onValueChange(value);
        }, 300);
    }, [onValueChange]);
    
    // テキスト入力の変更ハンドラ
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const text = e.target.value;
        setInputValue(text);
        
        const parsed = btn.valueType === 'int' ? parseInt(text) : parseFloat(text);
        if (!isNaN(parsed)) {
            setSliderValue(Math.max(min, Math.min(max, parsed)));
            debouncedSend(parsed);
        }
    };
    
    // スライダーの変更ハンドラ（リアルタイム送信）
    const handleSliderChange = (values: number[]) => {
        const value = values[0];
        const displayValue = btn.valueType === 'int' ? Math.round(value) : value;
        setSliderValue(displayValue);
        setInputValue(String(displayValue));
        onValueChange(displayValue);
    };
    
    // Enterキーで即時送信
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            const parsed = btn.valueType === 'int' ? parseInt(inputValue) : parseFloat(inputValue);
            if (!isNaN(parsed)) {
                onValueChange(parsed);
            }
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Input
                    type="number"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    step={step}
                    min={hasRange ? min : undefined}
                    max={hasRange ? max : undefined}
                    className="font-mono text-center"
                />
            </div>
            {hasRange && (
                <div className="space-y-1">
                    <Slider
                        value={[sliderValue]}
                        onValueChange={handleSliderChange}
                        min={min}
                        max={max}
                        step={step}
                        className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground font-mono">
                        <span>{min}</span>
                        <span>{max}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ config, statuses, buttonStates, buttonLastTriggered, onButtonClick, onValueChange, monitorValues }) => {
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

                        // Get monitors for this device (filter by deviceIds)
                        const deviceMonitors = (config.customMonitors || [])
                            .filter(m => m.enabled && m.deviceIds.includes(device.id));
                        const deviceMonitorValues = monitorValues?.[device.id] || {};

                        return (
                            <StatusCard
                                key={device.id}
                                name={device.name}
                                ip={device.ip}
                                port={device.port}
                                status={statuses[device.id] || { lastResponse: 0, isAlive: true }}
                                logics={targetLogics}
                                monitors={deviceMonitors}
                                monitorValues={deviceMonitorValues}
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
                            const isPeriodic = btn.mode === 'periodic';
                            const isValue = btn.mode === 'value';
                            const isOn = buttonStates[btn.id] || false;
                            const targetDevices = config.devices.filter(d => btn.deviceIds.includes(d.id));

                            return (
                                <Card key={btn.id} className="flex flex-col justify-between overflow-hidden relative">
                                    <CardHeader className="p-4 pb-2">
                                        <CardTitle className="text-base truncate flex items-center gap-2" title={btn.label}>
                                            {isValue && <Sliders className="w-4 h-4 text-muted-foreground" />}
                                            {btn.label}
                                        </CardTitle>
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
                                        {isValue ? (
                                            <ValueButtonControl
                                                btn={btn}
                                                onValueChange={(value) => onValueChange?.(btn, value)}
                                            />
                                        ) : (
                                            <Button
                                                onClick={() => onButtonClick(btn)}
                                                variant={(isToggle || isPeriodic) ? (isOn ? "default" : "outline") : "secondary"}
                                                className={cn(
                                                    "w-full font-semibold transition-all gap-2",
                                                    (isToggle || isPeriodic) && isOn && "bg-green-600 hover:bg-green-700 text-white",
                                                    !(isToggle || isPeriodic) && isOn && "bg-primary/90 text-primary-foreground scale-95"
                                                )}
                                            >
                                                {isPeriodic ? (
                                                    <>
                                                        {isOn ? <Pause className="w-4 h-4" /> : <Timer className="w-4 h-4" />}
                                                        {isOn ? 'Stop' : 'Start'}
                                                    </>
                                                ) : isToggle ? (
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
                                        )}
                                    </CardContent>
                                    {isPeriodic && isOn && (btn.periodicInterval || 0) > 0 && (
                                        <PeriodicButtonProgress
                                            interval={btn.periodicInterval!}
                                            lastTriggered={buttonLastTriggered[btn.id] || 0}
                                        />
                                    )}
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
