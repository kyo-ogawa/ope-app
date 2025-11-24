import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { MonitorConfig, Device, CustomButton, LogicRule } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Settings,
    Monitor,
    Bell,
    MousePointer2,
    Workflow,
    Plus,
    Trash2,
    Save,
    Server,
    Network,
    Laptop
} from "lucide-react";

interface ConfigFormProps {
    initialConfig: MonitorConfig;
    onSave: (config: MonitorConfig) => void;
}



export const ConfigForm: React.FC<ConfigFormProps> = ({ initialConfig, onSave }) => {
    const [config, setConfig] = useState<MonitorConfig>(initialConfig);
    const [localIp, setLocalIp] = useState<string>('Loading...');

    useEffect(() => {
        invoke<string>('get_local_ip')
            .then(ip => setLocalIp(ip))
            .catch(() => setLocalIp('Unknown'));
    }, []);

    useEffect(() => {
        setConfig(initialConfig);
    }, [initialConfig]);

    const updateDevice = (index: number, key: keyof Device, value: string | number) => {
        setConfig(prev => {
            const newDevices = [...prev.devices];
            newDevices[index] = { ...newDevices[index], [key]: value };
            return { ...prev, devices: newDevices };
        });
    };

    const addDevice = () => {
        setConfig(prev => ({
            ...prev,
            devices: [
                ...prev.devices,
                { id: crypto.randomUUID(), name: 'New Device', ip: '192.168.1.100', port: 8000 }
            ]
        }));
    };

    const removeDevice = (index: number) => {
        setConfig(prev => {
            const newDevices = prev.devices.filter((_, i) => i !== index);
            // Also remove from monitoredDeviceIds if present
            const removedId = prev.devices[index].id;
            const newMonitored = prev.monitoredDeviceIds.filter(id => id !== removedId);
            return { ...prev, devices: newDevices, monitoredDeviceIds: newMonitored };
        });
    };

    const toggleMonitoredDevice = (deviceId: string, checked: boolean) => {
        setConfig(prev => {
            const newMonitored = checked
                ? [...prev.monitoredDeviceIds, deviceId]
                : prev.monitoredDeviceIds.filter(id => id !== deviceId);
            return { ...prev, monitoredDeviceIds: newMonitored };
        });
    };

    const updateButton = (index: number, key: keyof CustomButton, value: string | number) => {
        setConfig(prev => {
            const newButtons = [...(prev.customButtons || [])];
            // @ts-ignore
            newButtons[index] = { ...newButtons[index], [key]: value };
            return { ...prev, customButtons: newButtons };
        });
    };

    const addButton = () => {
        setConfig(prev => ({
            ...prev,
            customButtons: [
                ...(prev.customButtons || []),
                {
                    id: crypto.randomUUID(),
                    label: 'New Button',
                    mode: 'momentary',
                    address: '/test',
                    args: '1',
                    deviceId: prev.devices.length > 0 ? prev.devices[0].id : ''
                }
            ]
        }));
    };

    const removeButton = (index: number) => {
        setConfig(prev => {
            const newButtons = (prev.customButtons || []).filter((_, i) => i !== index);
            return { ...prev, customButtons: newButtons };
        });
    };

    const updateLogic = (index: number, key: keyof LogicRule, value: any) => {
        setConfig(prev => {
            const newLogics = [...(prev.logics || [])];
            newLogics[index] = { ...newLogics[index], [key]: value };
            return { ...prev, logics: newLogics };
        });
    };

    const addLogic = () => {
        setConfig(prev => ({
            ...prev,
            logics: [
                ...(prev.logics || []),
                {
                    id: crypto.randomUUID(),
                    name: 'New Logic',
                    targetIds: [],
                    triggerStatus: 'offline',
                    actionButtonId: '',
                    enabled: true
                }
            ]
        }));
    };

    const removeLogic = (index: number) => {
        setConfig(prev => {
            const newLogics = (prev.logics || []).filter((_, i) => i !== index);
            return { ...prev, logics: newLogics };
        });
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(config);
    };

    return (
        <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Configuration</h2>
            <form onSubmit={handleSave}>
                <Tabs defaultValue="devices" className="w-full">
                    <TabsList className="grid w-full grid-cols-6">
                        <TabsTrigger value="devices" className="gap-2"><Laptop className="w-4 h-4" /> Devices</TabsTrigger>
                        <TabsTrigger value="targets" className="gap-2"><Monitor className="w-4 h-4" /> Targets</TabsTrigger>
                        <TabsTrigger value="settings" className="gap-2"><Settings className="w-4 h-4" /> Settings</TabsTrigger>
                        <TabsTrigger value="notify" className="gap-2"><Bell className="w-4 h-4" /> Notify</TabsTrigger>
                        <TabsTrigger value="buttons" className="gap-2"><MousePointer2 className="w-4 h-4" /> Buttons</TabsTrigger>
                        <TabsTrigger value="logics" className="gap-2"><Workflow className="w-4 h-4" /> Logics</TabsTrigger>
                    </TabsList>

                    <TabsContent value="devices" className="space-y-4 mt-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium flex items-center gap-2"><Laptop className="w-5 h-5" /> Manage Devices</h3>
                            <Button type="button" onClick={addDevice} variant="outline" className="gap-2">
                                <Plus className="w-4 h-4" /> Add Device
                            </Button>
                        </div>
                        <Card className="bg-muted/50 border-dashed">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Monitor className="w-4 h-4" /> This Device (Local)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input value="Localhost" disabled />
                                </div>
                                <div className="space-y-2">
                                    <Label>IP Address</Label>
                                    <Input value={localIp} disabled className="font-mono" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Port (Listen)</Label>
                                    <Input value={config.localPort} disabled />
                                </div>
                            </CardContent>
                        </Card>

                        {config.devices.map((device, index) => (
                            <Card key={device.id}>
                                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                    <CardTitle className="text-base">Device #{index + 1}</CardTitle>
                                    {config.devices.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeDevice(index)} className="text-destructive hover:text-destructive/90 hover:bg-destructive/10">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Name</Label>
                                        <Input
                                            value={device.name}
                                            onChange={e => updateDevice(index, 'name', e.target.value)}
                                            placeholder="Device Name"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>IP Address</Label>
                                        <Input
                                            value={device.ip}
                                            onChange={e => updateDevice(index, 'ip', e.target.value)}
                                            placeholder="192.168.1.x"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Port</Label>
                                        <Input
                                            type="number"
                                            value={device.port}
                                            onChange={e => updateDevice(index, 'port', parseInt(e.target.value))}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </TabsContent>

                    <TabsContent value="targets" className="space-y-4 mt-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium flex items-center gap-2"><Server className="w-5 h-5" /> Select Monitoring Targets</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {config.devices.map((device) => (
                                <Card key={device.id} className={config.monitoredDeviceIds.includes(device.id) ? "border-primary" : ""}>
                                    <CardHeader className="p-4 flex flex-row items-center space-y-0 gap-3">
                                        <Checkbox
                                            id={`monitor-${device.id}`}
                                            checked={config.monitoredDeviceIds.includes(device.id)}
                                            onCheckedChange={(checked) => toggleMonitoredDevice(device.id, checked === true)}
                                        />
                                        <div className="grid gap-1.5 leading-none">
                                            <Label htmlFor={`monitor-${device.id}`} className="font-semibold cursor-pointer">
                                                {device.name}
                                            </Label>
                                            <p className="text-sm text-muted-foreground">
                                                {device.ip}:{device.port}
                                            </p>
                                        </div>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                        {config.devices.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                No devices configured. Please add devices in the "Devices" tab first.
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="settings" className="space-y-4 mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Network className="w-5 h-5" /> Network & Timing</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Local Port (Listen)</Label>
                                        <Input
                                            type="number"
                                            value={config.localPort}
                                            onChange={e => setConfig({ ...config, localPort: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Interval (ms)</Label>
                                        <Input
                                            type="number"
                                            value={config.interval}
                                            onChange={e => setConfig({ ...config, interval: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Timeout (ms)</Label>
                                        <Input
                                            type="number"
                                            value={config.timeout}
                                            onChange={e => setConfig({ ...config, timeout: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                                    <div className="space-y-2">
                                        <Label>Ping Address</Label>
                                        <Input
                                            value={config.pingAddress || '/ping'}
                                            onChange={e => setConfig({ ...config, pingAddress: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Ping Args (comma separated)</Label>
                                        <Input
                                            value={config.pingArgs || ''}
                                            onChange={e => setConfig({ ...config, pingArgs: e.target.value })}
                                            placeholder="e.g. 1, test"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Pong Address (Expected)</Label>
                                        <Input
                                            value={config.pongAddress || '/pong'}
                                            onChange={e => setConfig({ ...config, pongAddress: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Pong Args (Expected match)</Label>
                                        <Input
                                            value={config.pongArgs || ''}
                                            onChange={e => setConfig({ ...config, pongArgs: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="notify" className="space-y-4 mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" /> Slack Notification</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Webhook URL</Label>
                                    <Input
                                        value={config.webhookUrl}
                                        onChange={e => setConfig({ ...config, webhookUrl: e.target.value })}
                                        placeholder="https://hooks.slack.com/services/..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Alert Message Template</Label>
                                    <Textarea
                                        value={config.alertMessage || "⚠️ Alert: {name} ({ip}) is DOWN!"}
                                        onChange={e => setConfig({ ...config, alertMessage: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground">Available variables: {'{name}'}, {'{ip}'}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Recovery Message Template</Label>
                                    <Textarea
                                        value={config.recoveryMessage || "✅ Recovery: {name} ({ip}) is UP!"}
                                        onChange={e => setConfig({ ...config, recoveryMessage: e.target.value })}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="buttons" className="space-y-4 mt-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium flex items-center gap-2"><MousePointer2 className="w-5 h-5" /> Custom Buttons</h3>
                            <Button type="button" onClick={addButton} variant="outline" className="gap-2">
                                <Plus className="w-4 h-4" /> Add Button
                            </Button>
                        </div>
                        {(config.customButtons || []).map((btn, index) => (
                            <Card key={btn.id}>
                                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                    <CardTitle className="text-base">Button #{index + 1}</CardTitle>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeButton(index)} className="text-destructive hover:text-destructive/90 hover:bg-destructive/10">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Label</Label>
                                            <Input
                                                value={btn.label}
                                                onChange={e => updateButton(index, 'label', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Mode</Label>
                                            <Select
                                                value={btn.mode}
                                                onValueChange={(val) => updateButton(index, 'mode', val)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="momentary">Momentary (One-shot)</SelectItem>
                                                    <SelectItem value="toggle">Toggle (ON/OFF)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Description</Label>
                                        <Input
                                            value={btn.description || ''}
                                            onChange={e => updateButton(index, 'description', e.target.value)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 pt-2 border-t">
                                        <div className="space-y-2">
                                            <Label>Target Device</Label>
                                            <Select
                                                value={btn.deviceId}
                                                onValueChange={(val) => updateButton(index, 'deviceId', val)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a device" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {config.devices.map(d => (
                                                        <SelectItem key={d.id} value={d.id}>{d.name} ({d.ip})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Address {btn.mode === 'toggle' ? '(ON)' : ''}</Label>
                                            <Input
                                                value={btn.address}
                                                onChange={e => updateButton(index, 'address', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Args {btn.mode === 'toggle' ? '(ON)' : ''}</Label>
                                            <Input
                                                value={btn.args}
                                                onChange={e => updateButton(index, 'args', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    {btn.mode === 'toggle' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 bg-muted/30 p-2 rounded">
                                            <div className="space-y-2">
                                                <Label>Address (OFF)</Label>
                                                <Input
                                                    value={btn.addressOff || ''}
                                                    onChange={e => updateButton(index, 'addressOff', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Args (OFF)</Label>
                                                <Input
                                                    value={btn.argsOff || ''}
                                                    onChange={e => updateButton(index, 'argsOff', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </TabsContent>

                    <TabsContent value="logics" className="space-y-4 mt-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium flex items-center gap-2"><Workflow className="w-5 h-5" /> Logic Rules</h3>
                            <Button type="button" onClick={addLogic} variant="outline" className="gap-2">
                                <Plus className="w-4 h-4" /> Add Rule
                            </Button>
                        </div>
                        {(config.logics || []).map((logic, index) => (
                            <Card key={logic.id}>
                                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                    <CardTitle className="text-base">Rule #{index + 1}</CardTitle>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`enabled-${logic.id}`}
                                                checked={logic.enabled}
                                                onCheckedChange={(checked) => updateLogic(index, 'enabled', checked === true)}
                                            />
                                            <Label htmlFor={`enabled-${logic.id}`}>Enabled</Label>
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeLogic(index)} className="text-destructive hover:text-destructive/90 hover:bg-destructive/10">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Rule Name</Label>
                                        <Input
                                            value={logic.name}
                                            onChange={e => updateLogic(index, 'name', e.target.value)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Trigger Status</Label>
                                            <Select
                                                value={logic.triggerStatus}
                                                onValueChange={(val) => updateLogic(index, 'triggerStatus', val)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="offline">When Target goes OFFLINE</SelectItem>
                                                    <SelectItem value="online">When Target goes ONLINE</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Action (Execute Button)</Label>
                                            <Select
                                                value={logic.actionButtonId}
                                                onValueChange={(val) => updateLogic(index, 'actionButtonId', val)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a button" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(config.customButtons || []).map(btn => (
                                                        <SelectItem key={btn.id} value={btn.id}>{btn.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Targets (Any of selected)</Label>
                                        <div className="grid grid-cols-2 gap-2 border p-2 rounded bg-muted/20">
                                            {config.devices.filter(d => config.monitoredDeviceIds.includes(d.id)).map(device => (
                                                <div key={device.id} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`logic-${logic.id}-${device.id}`}
                                                        checked={logic.targetIds.includes(device.id)}
                                                        onCheckedChange={(checked) => {
                                                            const newIds = checked
                                                                ? [...logic.targetIds, device.id]
                                                                : logic.targetIds.filter(id => id !== device.id);
                                                            updateLogic(index, 'targetIds', newIds);
                                                        }}
                                                    />
                                                    <Label htmlFor={`logic-${logic.id}-${device.id}`}>{device.name}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </TabsContent>

                    <div className="mt-6 flex justify-end">
                        <Button type="submit" size="lg" className="gap-2">
                            <Save className="w-4 h-4" /> Save & Start Monitoring
                        </Button>
                    </div>
                </Tabs>
            </form>
        </div>
    );
};
