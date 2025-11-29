import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';
import { ConfigForm } from './components/ConfigForm';
import { LogViewer } from './components/LogViewer';
import { Dashboard } from './components/Dashboard';
import { NetworkScanner } from './components/NetworkScanner';
import { MonitorConfig, PCStatus, CustomButton, LogEntry } from './types';
import { Button } from "@/components/ui/button";
import { Activity, LayoutDashboard, Settings, ScrollText, Play, Radar } from "lucide-react";


const DEFAULT_CONFIG: MonitorConfig = {
  devices: [
    { id: 'pc1', ip: '192.168.1.101', port: 8000, name: 'PC 1' },
    { id: 'pc2', ip: '192.168.1.102', port: 8000, name: 'PC 2' }
  ],
  monitoredDeviceIds: ['pc1', 'pc2'],
  localPort: 9000,
  interval: 1000,
  timeout: 3000,
  webhookUrl: '',
};

type View = 'dashboard' | 'config' | 'logs' | 'scanner';

function App() {
  const [config, setConfig] = useState<MonitorConfig>(DEFAULT_CONFIG);
  const [statuses, setStatuses] = useState<Record<string, PCStatus>>({});
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [buttonStates, setButtonStates] = useState<Record<string, boolean>>({});
  const [buttonLastTriggered, setButtonLastTriggered] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [appVersion, setAppVersion] = useState<string>('');

  useEffect(() => {
    // Get app version
    getVersion().then(setAppVersion).catch(console.error);

    const unlisten = listen<Record<string, PCStatus>>('status-update', (event) => {
      setStatuses(event.payload);
    });

    const unlistenLog = listen<LogEntry>('log-event', (event) => {
      setLogs(prev => [...prev.slice(-99), event.payload]);
    });

    const unlistenButton = listen<{ buttonId: string, timestamp: number }>('button-trigger', (event) => {
      // console.log('🔔 Button triggered:', event.payload);
      setButtonLastTriggered(prev => ({ ...prev, [event.payload.buttonId]: event.payload.timestamp }));
    });

    // Load config
    invoke<MonitorConfig>('load_config').then((savedConfig) => {
      if (savedConfig) {
        setConfig(savedConfig);
        // Auto-start
        invoke('start_monitoring', { config: savedConfig });
        setIsMonitoring(true);
      }
    }).catch((err) => {
      console.error('Failed to load config:', err);
    });

    return () => {
      unlisten.then(f => f());
      unlistenLog.then(f => f());
      unlistenButton.then(f => f());
    };
  }, []);

  const handleSaveConfig = (newConfig: MonitorConfig) => {
    setConfig(newConfig);
    invoke('save_config', { config: newConfig });
    invoke('start_monitoring', { config: newConfig });
    setIsMonitoring(true);
  };

  const handleStop = () => {
    invoke('stop_monitoring');
    setIsMonitoring(false);
  };

  const handleStart = () => {
    invoke('start_monitoring', { config });
    setIsMonitoring(true);
  };

  const handleButtonClick = async (btn: CustomButton) => {
    const isPeriodic = btn.mode === 'periodic';

    if (isPeriodic) {
      // Toggle periodic button enabled state
      const newState = await invoke<boolean>('toggle_periodic_button', { buttonId: btn.id });
      setButtonStates(prev => ({ ...prev, [btn.id]: newState }));
      return;
    }

    const isToggle = btn.mode === 'toggle';
    const currentState = buttonStates[btn.id] || false;
    const nextState = isToggle ? !currentState : false;

    if (isToggle) {
      setButtonStates(prev => ({ ...prev, [btn.id]: nextState }));
    } else {
      // Momentary effect
      setButtonStates(prev => ({ ...prev, [btn.id]: true }));
      setTimeout(() => {
        setButtonStates(prev => ({ ...prev, [btn.id]: false }));
      }, 200);
    }

    // 送信するアドレスと引数を決定
    const targetAddress = (isToggle && !nextState && btn.addressOff) ? btn.addressOff : btn.address;
    const targetArgs = (isToggle && !nextState && btn.argsOff) ? btn.argsOff : btn.args;

    // ターゲットデバイスを取得
    const targetDevices = config.devices.filter(d => btn.deviceIds.includes(d.id));

    // 各デバイスにOSCを送信
    for (const targetDevice of targetDevices) {
      invoke('send_osc', {
        ip: targetDevice.ip,
        port: targetDevice.port,
        address: targetAddress,
        args: targetArgs
      });
    }
  };

return (
  <div className="flex h-screen bg-background text-foreground overflow-hidden">
    {/* Sidebar Navigation */}
    <aside className="w-64 border-r bg-muted/20 flex flex-col">
      <div className="p-6 flex items-center gap-3 border-b">
        <div className="p-2 bg-primary rounded-lg">
          <Activity className="w-5 h-5 text-primary-foreground" />
        </div>
        <h1 className="font-bold tracking-tight">ope-app</h1>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <Button
          variant={currentView === 'dashboard' ? "secondary" : "ghost"}
          className="w-full justify-start gap-2"
          onClick={() => setCurrentView('dashboard')}
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </Button>
        <Button
          variant={currentView === 'scanner' ? "secondary" : "ghost"}
          className="w-full justify-start gap-2"
          onClick={() => setCurrentView('scanner')}
        >
          <Radar className="w-4 h-4" />
          IP Scanner
        </Button>
        <Button
          variant={currentView === 'config' ? "secondary" : "ghost"}
          className="w-full justify-start gap-2"
          onClick={() => setCurrentView('config')}
        >
          <Settings className="w-4 h-4" />
          Configuration
        </Button>
        <Button
          variant={currentView === 'logs' ? "secondary" : "ghost"}
          className="w-full justify-start gap-2"
          onClick={() => setCurrentView('logs')}
        >
          <ScrollText className="w-4 h-4" />
          System Logs
          {logs.length > 0 && (
            <span className="ml-auto text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded-full">
              {logs.length}
            </span>
          )}
        </Button>
      </nav>

      <div className="p-4 border-t">
        {isMonitoring ? (
          <Button onClick={handleStop} variant="destructive" className="w-full gap-2">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Stop Monitoring
          </Button>
        ) : (
          <Button onClick={handleStart} variant="default" className="w-full gap-2">
            <Play className="w-4 h-4" />
            Start Monitoring
          </Button>
        )}
      </div>

      {appVersion && (
        <div className="px-4 pb-4 text-xs text-muted-foreground/50 text-center">
          v{appVersion}
        </div>
      )}
    </aside>

    {/* Main Content */}
    <main className="flex-1 overflow-auto">
      <div className="container mx-auto p-8 max-w-5xl">
        <header className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight capitalize">
            {currentView === 'config' ? 'Configuration' : currentView === 'logs' ? 'System Logs' : currentView === 'scanner' ? 'IP Scanner' : 'Dashboard'}
          </h2>
          <p className="text-muted-foreground">
            {currentView === 'dashboard' && 'Monitor target status and execute custom actions.'}
            {currentView === 'scanner' && 'Discover devices on the same network segment.'}
            {currentView === 'config' && 'Manage monitoring targets, settings, and logic rules.'}
            {currentView === 'logs' && 'View real-time system logs and OSC messages.'}
          </p>
        </header>

        <div>
          <div className={currentView === 'dashboard' ? 'animate-in fade-in slide-in-from-bottom-4 duration-300' : 'hidden'}>
            <Dashboard
              config={config}
              statuses={statuses}
              buttonStates={buttonStates}
              buttonLastTriggered={buttonLastTriggered}
              onButtonClick={handleButtonClick}
            />
          </div>

          {/* NetworkScanner is always mounted to preserve state */}
          <div className={currentView === 'scanner' ? 'animate-in fade-in slide-in-from-bottom-4 duration-300' : 'hidden'}>
            <NetworkScanner />
          </div>

          <div className={currentView === 'config' ? 'animate-in fade-in slide-in-from-bottom-4 duration-300' : 'hidden'}>
            <ConfigForm initialConfig={config} onSave={handleSaveConfig} />
          </div>

          <div className={currentView === 'logs' ? 'animate-in fade-in slide-in-from-bottom-4 duration-300' : 'hidden'}>
            <LogViewer logs={logs} onClear={() => setLogs([])} />
          </div>
        </div>
      </div>
    </main>
  </div>
)
}

export default App
