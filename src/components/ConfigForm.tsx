import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { MonitorConfig, Device, CustomButton, LogicRule, CustomMonitor } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
    Settings,
    Monitor,
    Bell,
    MousePointer2,
    Workflow,
    Plus,
    Trash2,
    Server,
    Network,
    Laptop,
    Pencil,
    Eye,
    Radio
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

type SettingsDraft = {
    localPort: number;
    interval: number;
    timeout: number;
    pingAddress: string;
    pingArgs: string;
    pongAddress: string;
    pongArgs: string;
};

export const ConfigForm: React.FC<ConfigFormProps> = ({ initialConfig, onSave }) => {

    const [config, setConfig] = useState<MonitorConfig>(initialConfig);
    const [localIps, setLocalIps] = useState<string[]>([]);
    const [editingDevice, setEditingDevice] = useState<Device | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingButton, setEditingButton] = useState<CustomButton | null>(null);
    const [isEditButtonDialogOpen, setIsEditButtonDialogOpen] = useState(false);

    const [editingLogic, setEditingLogic] = useState<LogicRule | null>(null);
    const [isEditLogicDialogOpen, setIsEditLogicDialogOpen] = useState(false);

    // Custom Monitor state
    const [editingMonitor, setEditingMonitor] = useState<CustomMonitor | null>(null);
    const [isEditMonitorDialogOpen, setIsEditMonitorDialogOpen] = useState(false);

    const [editingSettings, setEditingSettings] = useState<SettingsDraft | null>(null);
    const [isEditSettingsDialogOpen, setIsEditSettingsDialogOpen] = useState(false);
    const shouldSkipSave = useRef(true);


    useEffect(() => {
        invoke<string[]>('get_local_ip')
            .then(ips => setLocalIps(ips))
            .catch(() => setLocalIps(['Unknown']));
    }, []);

    useEffect(() => {
        shouldSkipSave.current = true;
        setConfig(initialConfig);
    }, [initialConfig]);

    useEffect(() => {
        if (shouldSkipSave.current) {
            shouldSkipSave.current = false;
            return;
        }
        if (config.interval >= config.timeout) {
            return;
        }
        onSave(config);
    }, [config, onSave]);


    const handleEditDevice = (device: Device) => {
        setEditingDevice({ ...device });
        setIsEditDialogOpen(true);
    };

    const saveEditedDevice = () => {
        if (!editingDevice) return;

        const newConfig = {
            ...config,
            devices: config.devices.map(d =>
                d.id === editingDevice.id ? editingDevice : d
            )
        };
        setConfig(newConfig);
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

        const newConfig = {
            ...config,
            customButtons: (config.customButtons || []).map(b =>
                b.id === editingButton.id ? editingButton : b
            )
        };
        setConfig(newConfig);
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

        const newLogics = [...(config.logics || [])];
        const index = newLogics.findIndex(l => l.id === editingLogic.id);
        if (index !== -1) {
            newLogics[index] = editingLogic;
        }
        const newConfig = { ...config, logics: newLogics };
        setConfig(newConfig);
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

    // Custom Monitor functions
    const handleEditMonitor = (monitor: CustomMonitor) => {
        setEditingMonitor({ ...monitor, args: monitor.args.map(a => ({ ...a })), deviceIds: [...monitor.deviceIds] });
        setIsEditMonitorDialogOpen(true);
    };

    const saveEditedMonitor = () => {
        if (!editingMonitor) return;

        const newConfig = {
            ...config,
            customMonitors: (config.customMonitors || []).map(m =>
                m.id === editingMonitor.id ? editingMonitor : m
            )
        };
        setConfig(newConfig);
        setIsEditMonitorDialogOpen(false);
        setEditingMonitor(null);
    };

    const addMonitor = () => {
        const newMonitor: CustomMonitor = {
            id: crypto.randomUUID(),
            name: 'New Monitor',
            address: '/status',
            args: [{
                name: 'Value',
                argType: 'int',
                unit: '',
            }],
            deviceIds: config.devices.length > 0 ? [config.devices[0].id] : [],
            enabled: true
        };

        setConfig(prev => ({
            ...prev,
            customMonitors: [...(prev.customMonitors || []), newMonitor]
        }));
    };

    const removeMonitor = (monitorId: string) => {
        setConfig(prev => ({
            ...prev,
            customMonitors: (prev.customMonitors || []).filter(m => m.id !== monitorId)
        }));
    };

    const toggleMonitorEnabled = (monitorId: string, enabled: boolean) => {
        const newConfig = {
            ...config,
            customMonitors: (config.customMonitors || []).map(m =>
                m.id === monitorId ? { ...m, enabled } : m
            )
        };
        setConfig(newConfig);
    };

    const handleEditSettings = () => {
        setEditingSettings({
            localPort: config.localPort,
            interval: config.interval,
            timeout: config.timeout,
            pingAddress: config.pingAddress || '',
            pingArgs: config.pingArgs || '',
            pongAddress: config.pongAddress || '',
            pongArgs: config.pongArgs || ''
        });
        setIsEditSettingsDialogOpen(true);
    };

    const saveEditedSettings = () => {
        if (!editingSettings) return;

        const newConfig = {
            ...config,
            localPort: editingSettings.localPort,
            interval: editingSettings.interval,
            timeout: editingSettings.timeout,
            pingAddress: editingSettings.pingAddress,
            pingArgs: editingSettings.pingArgs,
            pongAddress: editingSettings.pongAddress,
            pongArgs: editingSettings.pongArgs
        };

        setConfig(newConfig);
        setIsEditSettingsDialogOpen(false);
        setEditingSettings(null);
    };


    return (
        <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Configuration</h2>
            <div>
                <Tabs defaultValue="devices" className="w-full">
                    <TabsList className="grid w-full grid-cols-7">
                        <TabsTrigger value="devices" className="gap-2"><Laptop className="w-4 h-4" /> Devices</TabsTrigger>
                        <TabsTrigger value="targets" className="gap-2"><Monitor className="w-4 h-4" /> Targets</TabsTrigger>
                        <TabsTrigger value="monitors" className="gap-2"><Eye className="w-4 h-4" /> Monitors</TabsTrigger>
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
                                    <Button type="button" onClick={saveEditedDevice}>Apply</Button>
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

                    <TabsContent value="monitors" className="space-y-4 mt-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium flex items-center gap-2"><Eye className="w-5 h-5" /> Custom Monitors</h3>
                            <Button type="button" onClick={addMonitor} variant="outline" className="gap-2">
                                <Plus className="w-4 h-4" /> Add Monitor
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            デバイスから受信するOSCメッセージを監視し、ダッシュボードに表示します。
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(config.customMonitors || []).map((monitor) => {
                                const targetDevices = config.devices.filter(d => monitor.deviceIds.includes(d.id));
                                return (
                                    <Card key={monitor.id} className={!monitor.enabled ? "opacity-50" : ""}>
                                        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                            <div className="flex items-center gap-2">
                                                <Radio className="w-4 h-4 text-muted-foreground" />
                                                <CardTitle className="text-base font-medium">{monitor.name}</CardTitle>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Switch
                                                    checked={monitor.enabled}
                                                    onCheckedChange={(checked) => toggleMonitorEnabled(monitor.id, checked)}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleEditMonitor(monitor)}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeMonitor(monitor.id)}
                                                    className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-sm text-muted-foreground space-y-1">
                                                <div className="flex justify-between">
                                                    <span>Address:</span>
                                                    <span className="font-mono text-foreground">{monitor.address}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Targets:</span>
                                                    <span className="font-mono text-foreground truncate max-w-[120px]" title={targetDevices.map(d => d.name).join(', ')}>
                                                        {targetDevices.length > 0
                                                            ? targetDevices.length === 1
                                                                ? targetDevices[0].name
                                                                : `${targetDevices.length} devices`
                                                            : 'None'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Args:</span>
                                                    <span className="font-mono text-foreground truncate max-w-[150px]" title={monitor.args.map(a => `${a.name} (${a.argType}${a.unit ? ` ${a.unit}` : ''})`).join(', ')}>
                                                        {monitor.args.map(a => `${a.name} (${a.argType})`).join(', ')}
                                                    </span>
                                                </div>
                                                {monitor.args.some(a => a.warningThreshold !== undefined || a.criticalThreshold !== undefined) && (
                                                    <div className="flex justify-between">
                                                        <span>Alerts:</span>
                                                        <span className="text-foreground">
                                                            {monitor.args.filter(a => a.warningThreshold !== undefined).length > 0 && (
                                                                <span className="text-yellow-600">⚠️</span>
                                                            )}
                                                            {monitor.args.filter(a => a.criticalThreshold !== undefined).length > 0 && (
                                                                <span className="text-red-600 ml-1">🔴</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>

                        {(config.customMonitors || []).length === 0 && (
                            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                No monitors configured. Click "Add Monitor" to create one.
                            </div>
                        )}

                        <Dialog open={isEditMonitorDialogOpen} onOpenChange={setIsEditMonitorDialogOpen}>
                            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Edit Monitor</DialogTitle>
                                    <DialogDescription>
                                        Configure the OSC address and arguments to monitor.
                                    </DialogDescription>
                                </DialogHeader>
                                {editingMonitor && (
                                    <div className="space-y-4 py-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Name</Label>
                                                <Input
                                                    value={editingMonitor.name}
                                                    onChange={e => setEditingMonitor({ ...editingMonitor, name: e.target.value })}
                                                    placeholder="e.g. Battery Status"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>OSC Address</Label>
                                                <Input
                                                    value={editingMonitor.address}
                                                    onChange={e => setEditingMonitor({ ...editingMonitor, address: e.target.value })}
                                                    placeholder="e.g. /battery"
                                                    className="font-mono"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2 pt-4 border-t">
                                            <Label>Target Devices (複数選択可)</Label>
                                            <div className="grid grid-cols-2 gap-2 border p-3 rounded bg-muted/20 max-h-40 overflow-y-auto">
                                                {config.devices.map(d => (
                                                    <div key={d.id} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`monitor-device-${d.id}`}
                                                            checked={editingMonitor.deviceIds.includes(d.id)}
                                                            onCheckedChange={(checked) => {
                                                                const newIds = checked
                                                                    ? [...editingMonitor.deviceIds, d.id]
                                                                    : editingMonitor.deviceIds.filter(id => id !== d.id);
                                                                setEditingMonitor({ ...editingMonitor, deviceIds: newIds });
                                                            }}
                                                        />
                                                        <Label htmlFor={`monitor-device-${d.id}`} className="text-sm cursor-pointer">
                                                            {d.name} ({d.ip})
                                                        </Label>
                                                    </div>
                                                ))}
                                            </div>
                                            {config.devices.length === 0 && (
                                                <p className="text-sm text-muted-foreground">No devices available. Add devices in the Devices tab first.</p>
                                            )}
                                        </div>

                                        <div className="space-y-3 pt-4 border-t">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-base">Arguments</Label>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setEditingMonitor({
                                                            ...editingMonitor,
                                                            args: [...editingMonitor.args, {
                                                                name: `Arg ${editingMonitor.args.length + 1}`,
                                                                argType: 'int',
                                                            }]
                                                        });
                                                    }}
                                                    className="gap-2"
                                                >
                                                    <Plus className="w-4 h-4" /> Add Argument
                                                </Button>
                                            </div>

                                            {editingMonitor.args.map((arg, argIndex) => (
                                                <Card key={argIndex} className="p-4">
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-medium text-sm">Argument {argIndex + 1}</span>
                                                            {editingMonitor.args.length > 1 && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        const newArgs = editingMonitor.args.filter((_, i) => i !== argIndex);
                                                                        setEditingMonitor({ ...editingMonitor, args: newArgs });
                                                                    }}
                                                                    className="h-6 w-6 text-destructive"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </Button>
                                                            )}
                                                        </div>

                                                        <div className="grid grid-cols-3 gap-3">
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Name</Label>
                                                                <Input
                                                                    value={arg.name}
                                                                    onChange={e => {
                                                                        const newArgs = [...editingMonitor.args];
                                                                        newArgs[argIndex] = { ...newArgs[argIndex], name: e.target.value };
                                                                        setEditingMonitor({ ...editingMonitor, args: newArgs });
                                                                    }}
                                                                    placeholder="e.g. Level"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Type</Label>
                                                                <Select
                                                                    value={arg.argType}
                                                                    onValueChange={(val) => {
                                                                        const newArgs = [...editingMonitor.args];
                                                                        newArgs[argIndex] = { ...newArgs[argIndex], argType: val as 'int' | 'float' | 'string' | 'bool' };
                                                                        setEditingMonitor({ ...editingMonitor, args: newArgs });
                                                                    }}
                                                                >
                                                                    <SelectTrigger>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="int">Integer</SelectItem>
                                                                        <SelectItem value="float">Float</SelectItem>
                                                                        <SelectItem value="string">String</SelectItem>
                                                                        <SelectItem value="bool">Boolean</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Unit (optional)</Label>
                                                                <Input
                                                                    value={arg.unit || ''}
                                                                    onChange={e => {
                                                                        const newArgs = [...editingMonitor.args];
                                                                        newArgs[argIndex] = { ...newArgs[argIndex], unit: e.target.value };
                                                                        setEditingMonitor({ ...editingMonitor, args: newArgs });
                                                                    }}
                                                                    placeholder="e.g. %, ℃"
                                                                />
                                                            </div>
                                                        </div>

                                                        {arg.argType === 'string' && (
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Value Mapping (JSON format, optional)</Label>
                                                                <Textarea
                                                                    value={arg.valueMapping ? JSON.stringify(arg.valueMapping, null, 2) : ''}
                                                                    onChange={e => {
                                                                        try {
                                                                            const parsed = e.target.value ? JSON.parse(e.target.value) : undefined;
                                                                            const newArgs = [...editingMonitor.args];
                                                                            newArgs[argIndex] = { ...newArgs[argIndex], valueMapping: parsed };
                                                                            setEditingMonitor({ ...editingMonitor, args: newArgs });
                                                                        } catch {
                                                                            // Invalid JSON, just update the text
                                                                        }
                                                                    }}
                                                                    placeholder='{"normal": "✅ Normal", "serious": "⚠️ Serious"}'
                                                                    className="font-mono text-xs h-20"
                                                                />
                                                            </div>
                                                        )}

                                                        {(arg.argType === 'int' || arg.argType === 'float') && (
                                                            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded">
                                                                <div className="space-y-2">
                                                                    <Label className="text-xs font-medium text-yellow-600">⚠️ Warning Threshold</Label>
                                                                    <div className="flex gap-2">
                                                                        <Select
                                                                            value={arg.warningCondition || 'below'}
                                                                            onValueChange={(val) => {
                                                                                const newArgs = [...editingMonitor.args];
                                                                                newArgs[argIndex] = { ...newArgs[argIndex], warningCondition: val as 'below' | 'above' };
                                                                                setEditingMonitor({ ...editingMonitor, args: newArgs });
                                                                            }}
                                                                        >
                                                                            <SelectTrigger className="w-[90px]">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="below">Below</SelectItem>
                                                                                <SelectItem value="above">Above</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                        <Input
                                                                            type="number"
                                                                            value={arg.warningThreshold ?? ''}
                                                                            onChange={e => {
                                                                                const val = parseFloat(e.target.value);
                                                                                const newArgs = [...editingMonitor.args];
                                                                                newArgs[argIndex] = { ...newArgs[argIndex], warningThreshold: isNaN(val) ? undefined : val };
                                                                                setEditingMonitor({ ...editingMonitor, args: newArgs });
                                                                            }}
                                                                            placeholder="20"
                                                                            className="flex-1"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label className="text-xs font-medium text-red-600">🔴 Critical Threshold</Label>
                                                                    <div className="flex gap-2">
                                                                        <Select
                                                                            value={arg.criticalCondition || 'below'}
                                                                            onValueChange={(val) => {
                                                                                const newArgs = [...editingMonitor.args];
                                                                                newArgs[argIndex] = { ...newArgs[argIndex], criticalCondition: val as 'below' | 'above' };
                                                                                setEditingMonitor({ ...editingMonitor, args: newArgs });
                                                                            }}
                                                                        >
                                                                            <SelectTrigger className="w-[90px]">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="below">Below</SelectItem>
                                                                                <SelectItem value="above">Above</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                        <Input
                                                                            type="number"
                                                                            value={arg.criticalThreshold ?? ''}
                                                                            onChange={e => {
                                                                                const val = parseFloat(e.target.value);
                                                                                const newArgs = [...editingMonitor.args];
                                                                                newArgs[argIndex] = { ...newArgs[argIndex], criticalThreshold: isNaN(val) ? undefined : val };
                                                                                setEditingMonitor({ ...editingMonitor, args: newArgs });
                                                                            }}
                                                                            placeholder="10"
                                                                            className="flex-1"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded">
                                                            <div className="flex items-center gap-2">
                                                                <Checkbox
                                                                    id={`slack-${argIndex}`}
                                                                    checked={arg.enableSlackNotification || false}
                                                                    onCheckedChange={(checked) => {
                                                                        const newArgs = [...editingMonitor.args];
                                                                        newArgs[argIndex] = { ...newArgs[argIndex], enableSlackNotification: checked === true };
                                                                        setEditingMonitor({ ...editingMonitor, args: newArgs });
                                                                    }}
                                                                />
                                                                <Label htmlFor={`slack-${argIndex}`} className="text-xs cursor-pointer">
                                                                    Slack通知 (閾値超過時)
                                                                </Label>
                                                            </div>
                                                        </div>
                                                        {arg.enableSlackNotification && (
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Slack Message Template</Label>
                                                                <Input
                                                                    value={arg.slackMessageTemplate || ''}
                                                                    onChange={e => {
                                                                        const newArgs = [...editingMonitor.args];
                                                                        newArgs[argIndex] = { ...newArgs[argIndex], slackMessageTemplate: e.target.value };
                                                                        setEditingMonitor({ ...editingMonitor, args: newArgs });
                                                                    }}
                                                                    placeholder="🔋 {device} battery: {value}{unit}"
                                                                />
                                                                <p className="text-xs text-muted-foreground">
                                                                    Variables: {'{device}'}, {'{value}'}, {'{unit}'}, {'{status}'}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsEditMonitorDialogOpen(false)}>Cancel</Button>
                                    <Button type="button" onClick={saveEditedMonitor}>Apply</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </TabsContent>

                    <TabsContent value="settings" className="space-y-4 mt-4">
                        <Card>

                            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="flex items-center gap-2"><Network className="w-5 h-5" /> Network & Timing</CardTitle>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={handleEditSettings}
                                >
                                    <Pencil className="w-4 h-4" /> Edit Settings
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Local Port (Listen)</Label>
                                        <Input type="number" value={config.localPort} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Interval (ms)</Label>
                                        <Input type="number" value={config.interval} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Timeout (ms)</Label>
                                        <Input type="number" value={config.timeout} disabled />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                                    <div className="space-y-2">
                                        <Label>Ping Address</Label>
                                        <Input value={config.pingAddress || '/ping'} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Ping Args (comma separated)</Label>
                                        <Input value={config.pingArgs || ''} placeholder="e.g. 1, test" disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Pong Address (Expected)</Label>
                                        <Input value={config.pongAddress || '/pong'} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Pong Args (Expected match)</Label>
                                        <Input value={config.pongArgs || ''} disabled />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t">
                                    <div className="space-y-0.5">
                                        <Label>Auto Start Monitoring</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Automatically start monitoring when the app launches
                                        </p>
                                    </div>
                                    <Switch
                                        checked={config.autoStart ?? false}
                                        onCheckedChange={(checked) => setConfig({ ...config, autoStart: checked })}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Dialog open={isEditSettingsDialogOpen} onOpenChange={setIsEditSettingsDialogOpen}>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Edit Settings</DialogTitle>
                                    <DialogDescription>Update network and timing parameters.</DialogDescription>
                                </DialogHeader>

                                {editingSettings && (
                                    <div className="space-y-4 py-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label>Local Port (Listen)</Label>
                                                <Input
                                                    type="number"
                                                    value={editingSettings.localPort}
                                                    onChange={e => setEditingSettings({ ...editingSettings, localPort: Number(e.target.value) || 0 })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Interval (ms)</Label>
                                                <Input
                                                    type="number"
                                                    value={editingSettings.interval}
                                                    onChange={e => setEditingSettings({ ...editingSettings, interval: Number(e.target.value) || 0 })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Timeout (ms)</Label>
                                                <Input
                                                    type="number"
                                                    value={editingSettings.timeout}
                                                    onChange={e => setEditingSettings({ ...editingSettings, timeout: Number(e.target.value) || 0 })}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                                            <div className="space-y-2">
                                                <Label>Ping Address</Label>
                                                <Input
                                                    value={editingSettings.pingAddress}
                                                    onChange={e => setEditingSettings({ ...editingSettings, pingAddress: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Ping Args (comma separated)</Label>
                                                <Input
                                                    value={editingSettings.pingArgs}
                                                    onChange={e => setEditingSettings({ ...editingSettings, pingArgs: e.target.value })}
                                                    placeholder="e.g. 1, test"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Pong Address (Expected)</Label>
                                                <Input
                                                    value={editingSettings.pongAddress}
                                                    onChange={e => setEditingSettings({ ...editingSettings, pongAddress: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Pong Args (Expected match)</Label>
                                                <Input
                                                    value={editingSettings.pongArgs}
                                                    onChange={e => setEditingSettings({ ...editingSettings, pongArgs: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsEditSettingsDialogOpen(false)}>Cancel</Button>
                                    <Button type="button" onClick={saveEditedSettings}>Apply</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
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
                                                    onValueChange={(val) => setEditingButton({ ...editingButton, mode: val as 'momentary' | 'toggle' | 'periodic' })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="momentary">Momentary (One-shot)</SelectItem>
                                                        <SelectItem value="toggle">Toggle (ON/OFF)</SelectItem>
                                                        <SelectItem value="periodic">Periodic (Interval)</SelectItem>
                                                        <SelectItem value="value">Value (Int/Float)</SelectItem>
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
                                        {editingButton.mode === 'periodic' && (
                                            <div className="space-y-2">
                                                <Label>Interval (ms)</Label>
                                                <Input
                                                    type="number"
                                                    value={editingButton.periodicInterval ?? ''}
                                                    onChange={e => {
                                                        const val = parseInt(e.target.value);
                                                        setEditingButton({ ...editingButton, periodicInterval: isNaN(val) ? undefined : val });
                                                    }}
                                                    placeholder="1000"
                                                />
                                            </div>
                                        )}
                                        {editingButton.mode === 'value' && (
                                            <div className="grid grid-cols-1 gap-4 pt-2 bg-muted/30 p-3 rounded">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Value Type</Label>
                                                        <Select
                                                            value={editingButton.valueType || 'int'}
                                                            onValueChange={(val) => setEditingButton({ ...editingButton, valueType: val as 'int' | 'float' })}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="int">Integer</SelectItem>
                                                                <SelectItem value="float">Float</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Default Value</Label>
                                                        <Input
                                                            type="number"
                                                            value={editingButton.valueDefault ?? ''}
                                                            onChange={e => {
                                                                const val = parseFloat(e.target.value);
                                                                setEditingButton({ ...editingButton, valueDefault: isNaN(val) ? undefined : val });
                                                            }}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Min (スライダー用、任意)</Label>
                                                        <Input
                                                            type="number"
                                                            value={editingButton.valueMin ?? ''}
                                                            onChange={e => {
                                                                const val = parseFloat(e.target.value);
                                                                setEditingButton({ ...editingButton, valueMin: isNaN(val) ? undefined : val });
                                                            }}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Max (スライダー用、任意)</Label>
                                                        <Input
                                                            type="number"
                                                            value={editingButton.valueMax ?? ''}
                                                            onChange={e => {
                                                                const val = parseFloat(e.target.value);
                                                                setEditingButton({ ...editingButton, valueMax: isNaN(val) ? undefined : val });
                                                            }}
                                                            placeholder="100"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Step</Label>
                                                        <Input
                                                            type="number"
                                                            value={editingButton.valueStep ?? ''}
                                                            onChange={e => {
                                                                const val = parseFloat(e.target.value);
                                                                setEditingButton({ ...editingButton, valueStep: isNaN(val) ? undefined : val });
                                                            }}
                                                            placeholder={editingButton.valueType === 'float' ? '0.1' : '1'}
                                                        />
                                                    </div>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    ※ MinとMaxを両方設定するとスライダーが表示されます。設定しない場合はテキスト入力のみになります。
                                                </p>
                                            </div>
                                        )}
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
                                    <Button type="button" onClick={saveEditedButton}>Apply</Button>
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
                                    <Button type="button" onClick={saveEditedLogic}>Apply</Button>
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
                    </div>
                </Tabs>
            </div>
        </div>
    );
};
