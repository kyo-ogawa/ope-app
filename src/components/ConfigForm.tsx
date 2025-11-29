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
    Laptop,
    Pencil
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface ConfigFormProps {
    initialConfig: MonitorConfig;
    onSave: (config: MonitorConfig) => void;
}



export const ConfigForm: React.FC<ConfigFormProps> = ({ initialConfig, onSave }) => {
    const [config, setConfig] = useState<MonitorConfig>(initialConfig);
    const [localIps, setLocalIps] = useState<string[]>([]);
    const [editingDevice, setEditingDevice] = useState<Device | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingButton, setEditingButton] = useState<CustomButton | null>(null);
    const [isEditButtonDialogOpen, setIsEditButtonDialogOpen] = useState(false);

    const [editingLogic, setEditingLogic] = useState<LogicRule | null>(null);
    const [isEditLogicDialogOpen, setIsEditLogicDialogOpen] = useState(false);

    useEffect(() => {
        invoke<string[]>('get_local_ip')
            .then(ips => setLocalIps(ips))
            .catch(() => setLocalIps(['Unknown']));
    }, []);

    useEffect(() => {
        setConfig(initialConfig);
    }, [initialConfig]);



    const handleEditDevice = (device: Device) => {
        setEditingDevice({ ...device });
        setIsEditDialogOpen(true);
    };

    const saveEditedDevice = () => {
        if (!editingDevice) return;

        setConfig(prev => {
            const newDevices = prev.devices.map(d =>
                d.id === editingDevice.id ? editingDevice : d
            );
            return { ...prev, devices: newDevices };
        });
        setIsEditDialogOpen(false);
        setEditingDevice(null);
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



    const handleEditButton = (button: CustomButton) => {
        setEditingButton({ ...button });
        setIsEditButtonDialogOpen(true);
    };

    const saveEditedButton = () => {
        if (!editingButton) return;

        setConfig(prev => {
            const newButtons = (prev.customButtons || []).map(b =>
                b.id === editingButton.id ? editingButton : b
            );
            return { ...prev, customButtons: newButtons };
        });
        setIsEditButtonDialogOpen(false);
        setEditingButton(null);
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
                    args: [{ value: '1', argType: 'int' }],
                    deviceIds: prev.devices.length > 0 ? [prev.devices[0].id] : []
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

    const handleEditLogic = (logic: LogicRule) => {
        setEditingLogic({ ...logic });
        setIsEditLogicDialogOpen(true);
    };

    const saveEditedLogic = () => {
        if (!editingLogic) return;
        setConfig(prev => {
            const newLogics = [...(prev.logics || [])];
            const index = newLogics.findIndex(l => l.id === editingLogic.id);
            if (index !== -1) {
                newLogics[index] = editingLogic;
            } else {
                // If it's a new logic not in the list yet (though we add it first usually)
                // But here we edit existing ones.
            }
            return { ...prev, logics: newLogics };
        });
        setIsEditLogicDialogOpen(false);
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
                                    <Label>IP Addresses</Label>
                                    <div className="space-y-1">
                                        {localIps.length > 0 ? (
                                            localIps.map((ip, i) => (
                                                <Input key={i} value={ip} disabled className="font-mono h-8 text-sm" />
                                            ))
                                        ) : (
                                            <Input value="Loading..." disabled className="font-mono" />
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Port (Listen)</Label>
                                    <Input value={config.localPort} disabled />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {config.devices.map((device, index) => (
                                <Card key={device.id}>
                                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                        <div className="flex items-center gap-2">
                                            <Laptop className="w-4 h-4 text-muted-foreground" />
                                            <CardTitle className="text-base font-medium">{device.name}</CardTitle>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleEditDevice(device)}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeDevice(index)}
                                                className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-sm text-muted-foreground space-y-1">
                                            <div className="flex justify-between">
                                                <span>IP Address:</span>
                                                <span className="font-mono text-foreground">{device.ip}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Port:</span>
                                                <span className="font-mono text-foreground">{device.port}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Edit Device</DialogTitle>
                                    <DialogDescription>
                                        Make changes to the device configuration here. Click save when you're done.
                                    </DialogDescription>
                                </DialogHeader>
                                {editingDevice && (
                                    <div className="grid gap-4 py-4">
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="name" className="text-right">
                                                Name
                                            </Label>
                                            <Input
                                                id="name"
                                                value={editingDevice.name}
                                                onChange={(e) => setEditingDevice({ ...editingDevice, name: e.target.value })}
                                                className="col-span-3"
                                            />
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="ip" className="text-right">
                                                IP Address
                                            </Label>
                                            <Input
                                                id="ip"
                                                value={editingDevice.ip}
                                                onChange={(e) => setEditingDevice({ ...editingDevice, ip: e.target.value })}
                                                className="col-span-3"
                                            />
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="port" className="text-right">
                                                Port
                                            </Label>
                                            <Input
                                                id="port"
                                                type="number"
                                                value={editingDevice.port}
                                                onChange={(e) => setEditingDevice({ ...editingDevice, port: parseInt(e.target.value) })}
                                                className="col-span-3"
                                            />
                                        </div>
                                    </div>
                                )}
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                                    <Button type="button" onClick={saveEditedDevice}>Save changes</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(config.customButtons || []).map((btn, index) => (
                                <Card key={btn.id}>
                                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                        <div className="flex items-center gap-2">
                                            <MousePointer2 className="w-4 h-4 text-muted-foreground" />
                                            <CardTitle className="text-base font-medium">{btn.label}</CardTitle>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleEditButton(btn)}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeButton(index)}
                                                className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-sm text-muted-foreground space-y-1">
                                            <div className="flex justify-between">
                                                <span>Mode:</span>
                                                <span className="font-medium text-foreground capitalize">{btn.mode}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Targets:</span>
                                                <span className="font-mono text-foreground truncate max-w-[120px]" title={btn.deviceIds.map(id => config.devices.find(d => d.id === id)?.name || 'Unknown').join(', ')}>
                                                    {btn.deviceIds.length > 0
                                                        ? btn.deviceIds.length === 1
                                                            ? config.devices.find(d => d.id === btn.deviceIds[0])?.name || 'Unknown'
                                                            : `${btn.deviceIds.length} devices`
                                                        : 'None'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Address:</span>
                                                <span className="font-mono text-foreground truncate max-w-[150px]" title={btn.address}>{btn.address}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Args:</span>
                                                <span className="font-mono text-foreground truncate max-w-[150px]" title={btn.args.map(a => `${a.value} (${a.argType})`).join(', ')}>
                                                    {btn.args.map(a => `${a.value} (${a.argType})`).join(', ')}
                                                </span>
                                            </div>
                                            {btn.description && (
                                                <div className="text-xs italic mt-2 border-t pt-2">
                                                    {btn.description}
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <Dialog open={isEditButtonDialogOpen} onOpenChange={setIsEditButtonDialogOpen}>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Edit Button</DialogTitle>
                                    <DialogDescription>
                                        Configure the custom button actions.
                                    </DialogDescription>
                                </DialogHeader>
                                {editingButton && (
                                    <div className="space-y-4 py-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Label</Label>
                                                <Input
                                                    value={editingButton.label}
                                                    onChange={e => setEditingButton({ ...editingButton, label: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Mode</Label>
                                                <Select
                                                    value={editingButton.mode}
                                                    onValueChange={(val) => setEditingButton({ ...editingButton, mode: val as 'momentary' | 'toggle' })}
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
                                                value={editingButton.description || ''}
                                                onChange={e => setEditingButton({ ...editingButton, description: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 pt-2 border-t">
                                            <div className="space-y-2">
                                                <Label>Target Devices (複数選択可)</Label>
                                                <div className="grid grid-cols-2 gap-2 border p-3 rounded bg-muted/20 max-h-40 overflow-y-auto">
                                                    {config.devices.map(d => (
                                                        <div key={d.id} className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id={`btn-device-${d.id}`}
                                                                checked={editingButton.deviceIds.includes(d.id)}
                                                                onCheckedChange={(checked) => {
                                                                    const newIds = checked
                                                                        ? [...editingButton.deviceIds, d.id]
                                                                        : editingButton.deviceIds.filter(id => id !== d.id);
                                                                    setEditingButton({ ...editingButton, deviceIds: newIds });
                                                                }}
                                                            />
                                                            <Label htmlFor={`btn-device-${d.id}`} className="text-sm cursor-pointer">
                                                                {d.name} ({d.ip})
                                                            </Label>
                                                        </div>
                                                    ))}
                                                </div>
                                                {config.devices.length === 0 && (
                                                    <p className="text-sm text-muted-foreground">No devices available. Add devices in the Devices tab first.</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Address {editingButton.mode === 'toggle' ? '(ON)' : ''}</Label>
                                                <Input
                                                    value={editingButton.address}
                                                    onChange={e => setEditingButton({ ...editingButton, address: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Args {editingButton.mode === 'toggle' ? '(ON)' : ''}</Label>
                                                <div className="space-y-2">
                                                    {editingButton.args.map((arg, i) => (
                                                        <div key={i} className="flex gap-2">
                                                            <Select
                                                                value={arg.argType}
                                                                onValueChange={(val) => {
                                                                    const newArgs = [...editingButton.args];
                                                                    newArgs[i] = { ...newArgs[i], argType: val as 'string' | 'int' | 'float' };
                                                                    setEditingButton({ ...editingButton, args: newArgs });
                                                                }}
                                                            >
                                                                <SelectTrigger className="w-[100px]">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="string">String</SelectItem>
                                                                    <SelectItem value="int">Int</SelectItem>
                                                                    <SelectItem value="float">Float</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <Input
                                                                value={arg.value}
                                                                onChange={(e) => {
                                                                    const newArgs = [...editingButton.args];
                                                                    newArgs[i] = { ...newArgs[i], value: e.target.value };
                                                                    setEditingButton({ ...editingButton, args: newArgs });
                                                                }}
                                                                className="flex-1"
                                                                placeholder="Value"
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    const newArgs = editingButton.args.filter((_, idx) => idx !== i);
                                                                    setEditingButton({ ...editingButton, args: newArgs });
                                                                }}
                                                                className="text-destructive"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setEditingButton({
                                                                ...editingButton,
                                                                args: [...editingButton.args, { value: '', argType: 'string' }]
                                                            });
                                                        }}
                                                        className="w-full gap-2"
                                                    >
                                                        <Plus className="w-4 h-4" /> Add Argument
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                        {editingButton.mode === 'toggle' && (
                                            <div className="grid grid-cols-1 gap-4 pt-2 bg-muted/30 p-2 rounded">
                                                <div className="space-y-2">
                                                    <Label>Address (OFF)</Label>
                                                    <Input
                                                        value={editingButton.addressOff || ''}
                                                        onChange={e => setEditingButton({ ...editingButton, addressOff: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Args (OFF)</Label>
                                                    <div className="space-y-2">
                                                        {(editingButton.argsOff || []).map((arg, i) => (
                                                            <div key={i} className="flex gap-2">
                                                                <Select
                                                                    value={arg.argType}
                                                                    onValueChange={(val) => {
                                                                        const newArgs = [...(editingButton.argsOff || [])];
                                                                        newArgs[i] = { ...newArgs[i], argType: val as 'string' | 'int' | 'float' };
                                                                        setEditingButton({ ...editingButton, argsOff: newArgs });
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="w-[100px]">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="string">String</SelectItem>
                                                                        <SelectItem value="int">Int</SelectItem>
                                                                        <SelectItem value="float">Float</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <Input
                                                                    value={arg.value}
                                                                    onChange={(e) => {
                                                                        const newArgs = [...(editingButton.argsOff || [])];
                                                                        newArgs[i] = { ...newArgs[i], value: e.target.value };
                                                                        setEditingButton({ ...editingButton, argsOff: newArgs });
                                                                    }}
                                                                    className="flex-1"
                                                                    placeholder="Value"
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        const newArgs = (editingButton.argsOff || []).filter((_, idx) => idx !== i);
                                                                        setEditingButton({ ...editingButton, argsOff: newArgs });
                                                                    }}
                                                                    className="text-destructive"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setEditingButton({
                                                                    ...editingButton,
                                                                    argsOff: [...(editingButton.argsOff || []), { value: '', argType: 'string' }]
                                                                });
                                                            }}
                                                            className="w-full gap-2"
                                                        >
                                                            <Plus className="w-4 h-4" /> Add Argument
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsEditButtonDialogOpen(false)}>Cancel</Button>
                                    <Button type="button" onClick={saveEditedButton}>Save changes</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </TabsContent>

                    <TabsContent value="logics" className="space-y-4 mt-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium flex items-center gap-2"><Workflow className="w-5 h-5" /> Logic Rules</h3>
                            <Button type="button" onClick={addLogic} variant="outline" className="gap-2">
                                <Plus className="w-4 h-4" /> Add Rule
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            {(config.logics || []).map((logic, index) => (
                                <Card key={logic.id}>
                                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                        <div className="flex items-center gap-2">
                                            <Workflow className="w-4 h-4 text-muted-foreground" />
                                            <CardTitle className="text-base font-medium">{logic.name}</CardTitle>
                                            {!logic.enabled && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">Disabled</span>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditLogic(logic)}>
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeLogic(index)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-sm text-muted-foreground space-y-1">
                                            <div className="flex justify-between">
                                                <span>Trigger:</span>
                                                <span className="font-medium text-foreground">
                                                    {logic.triggerStatus === 'offline' ? 'Goes OFFLINE' : 'Goes ONLINE'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Action:</span>
                                                <span className="font-medium text-foreground">
                                                    {config.customButtons?.find(b => b.id === logic.actionButtonId)?.label || 'None'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Targets:</span>
                                                <span className="font-medium text-foreground truncate max-w-[200px]">
                                                    {logic.targetIds.map(tid => config.devices.find(d => d.id === tid)?.name).filter(Boolean).join(', ') || 'None'}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <Dialog open={isEditLogicDialogOpen} onOpenChange={setIsEditLogicDialogOpen}>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Edit Logic Rule</DialogTitle>
                                    <DialogDescription>Configure automation rules.</DialogDescription>
                                </DialogHeader>
                                {editingLogic && (
                                    <div className="grid gap-4 py-4">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="edit-logic-enabled"
                                                checked={editingLogic.enabled}
                                                onCheckedChange={(checked) => setEditingLogic({ ...editingLogic, enabled: checked === true })}
                                            />
                                            <Label htmlFor="edit-logic-enabled">Enabled</Label>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Rule Name</Label>
                                            <Input
                                                value={editingLogic.name}
                                                onChange={e => setEditingLogic({ ...editingLogic, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Trigger Status</Label>
                                                <Select
                                                    value={editingLogic.triggerStatus}
                                                    onValueChange={(val) => setEditingLogic({ ...editingLogic, triggerStatus: val as 'online' | 'offline' })}
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
                                                    value={editingLogic.actionButtonId}
                                                    onValueChange={(val) => setEditingLogic({ ...editingLogic, actionButtonId: val })}
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
                                                            id={`edit-logic-${device.id}`}
                                                            checked={editingLogic.targetIds.includes(device.id)}
                                                            onCheckedChange={(checked) => {
                                                                const newIds = checked
                                                                    ? [...editingLogic.targetIds, device.id]
                                                                    : editingLogic.targetIds.filter(id => id !== device.id);
                                                                setEditingLogic({ ...editingLogic, targetIds: newIds });
                                                            }}
                                                        />
                                                        <Label htmlFor={`edit-logic-${device.id}`}>{device.name}</Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsEditLogicDialogOpen(false)}>Cancel</Button>
                                    <Button type="button" onClick={saveEditedLogic}>Save changes</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </TabsContent>

                    <div className="mt-6 flex flex-col items-end gap-2">
                        {config.interval >= config.timeout && (
                            <p className="text-sm text-destructive font-medium">
                                Interval must be less than Timeout (Interval &lt; Timeout)
                            </p>
                        )}
                        <Button 
                            type="submit" 
                            size="lg" 
                            className="gap-2"
                            disabled={config.interval >= config.timeout}
                        >
                            <Save className="w-4 h-4" /> Save & Start Monitoring
                        </Button>
                    </div>
                </Tabs>
            </form>
        </div>
    );
};
