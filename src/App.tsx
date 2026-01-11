import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';
import { open, save } from '@tauri-apps/plugin-dialog';
import { ConfigForm } from './components/ConfigForm';
import { LogViewer } from './components/LogViewer';
import { Dashboard } from './components/Dashboard';
import { NetworkScanner } from './components/NetworkScanner';
import { FlowViewer } from './components/FlowViewer';
import { MonitorConfig, PCStatus, CustomButton, LogEntry, MonitorValueEvent, MonitorValue } from './types';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LayoutDashboard, Settings, ScrollText, Play, Radar, GitBranch, Moon, Sun, Pencil, Plus, Trash2, Download } from "lucide-react";




import opeIcon from './assets/ope-icon.png';
import { useTheme } from './components/ThemeProvider';


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

type View = 'dashboard' | 'config' | 'logs' | 'scanner' | 'flows';

type SaveConfigOptions = {
  skipProfileSave?: boolean;
  profileName?: string;
};

function App() {
  const { theme, toggleTheme } = useTheme();
  const [config, setConfig] = useState<MonitorConfig>(DEFAULT_CONFIG);
  const [statuses, setStatuses] = useState<Record<string, PCStatus>>({});
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [buttonStates, setButtonStates] = useState<Record<string, boolean>>({});
  const [buttonLastTriggered, setButtonLastTriggered] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [appVersion, setAppVersion] = useState<string>('');
  // Custom Monitor values: deviceId -> monitorId -> MonitorValue
  const [monitorValues, setMonitorValues] = useState<Record<string, Record<string, MonitorValue>>>({});

  const [profiles, setProfiles] = useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [profileName, setProfileName] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
  const profileSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);




  const refreshProfiles = async (preferred?: string) => {
    try {
      const list = await invoke<string[]>('list_profiles');
      setProfiles(list);
      setProfileError(null);

      if (list.length === 0) {
        setSelectedProfile('');
        return;
      }

      const preferredName = preferred ?? selectedProfile;
      if (preferredName && list.includes(preferredName)) {
        setSelectedProfile(preferredName);
        return;
      }

      setSelectedProfile(list[0]);
    } catch (err) {
      console.error('Failed to list profiles:', err);
      setProfileError('プロファイル一覧の取得に失敗しました。');
    }
  };

  const handleCreateProfile = async () => {
    const trimmedName = profileName.trim();
    if (!trimmedName) {
      setProfileError('プロファイル名を入力してください。');
      return;
    }

    try {
      setProfileError(null);
      await invoke('save_profile', { name: trimmedName, config });
      setProfileName('');
      setSelectedProfile(trimmedName);
      await refreshProfiles(trimmedName);
    } catch (err) {
      console.error('Failed to save profile:', err);
      setProfileError('プロファイルの保存に失敗しました。');
    }
  };


  const handleLoadProfile = async (name?: string) => {
    const targetName = name ?? selectedProfile;
    if (!targetName) {
      setProfileError('読み込むプロファイルを選択してください。');
      return;
    }

    try {
      setProfileError(null);
      const loadedConfig = await invoke<MonitorConfig>('load_profile', { name: targetName });
      setSelectedProfile(targetName);
      handleSaveConfig(loadedConfig, { skipProfileSave: true, profileName: targetName });
    } catch (err) {
      console.error('Failed to load profile:', err);
      setProfileError('プロファイルの読み込みに失敗しました。');
    }
  };

  const handleImportProfile = async () => {
    try {
      setProfileError(null);
      const selected = await open({
        title: 'プロファイルを選択',
        multiple: false,
        directory: false,
        filters: [{ name: 'Profile', extensions: ['json'] }]
      });

      if (!selected || Array.isArray(selected)) {
        return;
      }

      const importedName = await invoke<string>('import_profile_from_file', { path: selected });
      await refreshProfiles(importedName);
      await handleLoadProfile(importedName);
    } catch (err) {
      console.error('Failed to import profile:', err);
      setProfileError('プロファイルの読み込みに失敗しました。');
    }
  };

  const handleExportProfile = async () => {
    if (!selectedProfile) {
      setProfileError('エクスポートするプロファイルを選択してください。');
      return;
    }

    try {
      setProfileError(null);
      const destination = await save({
        title: 'プロファイルを保存',
        defaultPath: `${selectedProfile}.json`,
        filters: [{ name: 'Profile', extensions: ['json'] }]
      });

      if (!destination) {
        return;
      }

      await invoke('export_profile_to_file', { name: selectedProfile, path: destination });
    } catch (err) {
      console.error('Failed to export profile:', err);
      setProfileError('プロファイルのエクスポートに失敗しました。');
    }
  };

  const handleSelectProfile = (name: string) => {
    setSelectedProfile(name);
    void handleLoadProfile(name);
  };

  const handleProfileSelection = (name: string) => {
    if (name === '__import__') {
      void handleImportProfile();
      return;
    }
    handleSelectProfile(name);
  };

  const handleDeleteProfile = async (name: string) => {
    try {
      setProfileError(null);
      await invoke('delete_profile', { name });
      const nextSelected = selectedProfile === name ? '' : selectedProfile;
      await refreshProfiles(nextSelected);
    } catch (err) {
      console.error('Failed to delete profile:', err);
      setProfileError('プロファイルの削除に失敗しました。');
    }
  };

  useEffect(() => {
    refreshProfiles();

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

    const unlistenMonitorValue = listen<MonitorValueEvent>('monitor-value', (event) => {
      const { deviceId, monitorId, args, timestamp } = event.payload;
      setMonitorValues(prev => ({
        ...prev,
        [deviceId]: {
          ...prev[deviceId],
          [monitorId]: {
            args,
            lastUpdated: timestamp
          }
        }
      }));
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
      unlistenMonitorValue.then(f => f());
    };
  }, []);

  const handleSaveConfig = (newConfig: MonitorConfig, options: SaveConfigOptions = {}) => {
    setConfig(newConfig);
    invoke('save_config', { config: newConfig });

    if (isMonitoring) {
      invoke('start_monitoring', { config: newConfig });
    }

    if (options.skipProfileSave) {
      if (profileSaveTimeout.current) {
        clearTimeout(profileSaveTimeout.current);
        profileSaveTimeout.current = null;
      }
      return;
    }

    const targetProfile = options.profileName ?? selectedProfile;
    if (!targetProfile) {
      return;
    }

    if (profileSaveTimeout.current) {
      clearTimeout(profileSaveTimeout.current);
    }

    profileSaveTimeout.current = setTimeout(() => {
      invoke('save_profile', { name: targetProfile, config: newConfig }).catch((err) => {
        console.error('Failed to auto-save profile:', err);
        setProfileError('プロファイルの保存に失敗しました。');
      });
    }, 500);
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

  // Value mode handler
  const handleValueChange = (btn: CustomButton, value: number) => {
    const targetDevices = config.devices.filter(d => btn.deviceIds.includes(d.id));
    
    // 値の型に応じてOscArgを作成
    const valueArg = {
      value: String(value),
      argType: btn.valueType || 'int'
    };
    
    // 各デバイスにOSCを送信
    for (const targetDevice of targetDevices) {
      invoke('send_osc', {
        ip: targetDevice.ip,
        port: targetDevice.port,
        address: btn.address,
        args: [valueArg]
      });
    }
  };

return (
  <div className="flex h-screen bg-background text-foreground overflow-hidden">
    {/* Sidebar Navigation */}
    <aside className="w-64 border-r bg-muted/20 flex flex-col">
      <div className="p-6 flex items-center gap-3 border-b">
        <div className="p-2 rounded-lg">
          <img src={opeIcon} alt="ope-app" className="w-8 h-8" />
        </div>
        <h1 className="font-bold tracking-tight">ope-app</h1>
      </div>

      <div className="px-4 py-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase text-muted-foreground">プロファイル</Label>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExportProfile}
              disabled={!selectedProfile}
              aria-label="プロファイルをエクスポート"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsProfileDialogOpen(true);
                refreshProfiles();
              }}
              aria-label="プロファイルを編集"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <Select value={selectedProfile} onValueChange={handleProfileSelection}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="プロファイルを選択" />
          </SelectTrigger>
          <SelectContent>
            {profiles.length === 0 ? (
              <SelectItem value="__empty" disabled>
                プロファイルがありません
              </SelectItem>
            ) : (
              profiles.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))
            )}
            <SelectItem value="__import__">外部ファイルから読み込む...</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">変更は自動で保存されます。</p>
        {profileError && <p className="text-xs text-destructive">{profileError}</p>}
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
          variant={currentView === 'flows' ? "secondary" : "ghost"}
          className="w-full justify-start gap-2"
          onClick={() => setCurrentView('flows')}
        >
          <GitBranch className="w-4 h-4" />
          Flows
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

      <div className="p-4 border-t space-y-2">
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
        
        <Button 
          onClick={toggleTheme} 
          variant="outline" 
          className="w-full gap-2"
          title={theme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-4 h-4" />
              ダークモード
            </>
          ) : (
            <>
              <Sun className="w-4 h-4" />
              ライトモード
            </>
          )}
        </Button>
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
            {currentView === 'config' ? 'Configuration' : currentView === 'logs' ? 'System Logs' : currentView === 'scanner' ? 'IP Scanner' : currentView === 'flows' ? 'Flows' : 'Dashboard'}
          </h2>
          <p className="text-muted-foreground">
            {currentView === 'dashboard' && 'Monitor target status and execute custom actions.'}
            {currentView === 'scanner' && 'Discover devices on the same network segment.'}
            {currentView === 'flows' && 'Visualize OSC message flows between devices.'}
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
              onValueChange={handleValueChange}
              monitorValues={monitorValues}
            />
          </div>

          {/* NetworkScanner is always mounted to preserve state */}
          <div className={currentView === 'scanner' ? 'animate-in fade-in slide-in-from-bottom-4 duration-300' : 'hidden'}>
            <NetworkScanner />
          </div>

          {/* FlowViewer is always mounted to preserve state */}
          <div className={currentView === 'flows' ? 'animate-in fade-in slide-in-from-bottom-4 duration-300' : 'hidden'}>
            <FlowViewer config={config} />
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

    <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>プロファイルを編集</DialogTitle>
          <DialogDescription>
            現在の基本セッティングを保存したり、不要なプロファイルを削除できます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">新規プロファイル名</Label>
            <div className="flex gap-2">
              <Input
                id="profile-name"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                placeholder="案件名など"
              />
              <Button type="button" onClick={handleCreateProfile} className="gap-2">
                <Plus className="w-4 h-4" />
                追加
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>プロファイル一覧</Label>
            {profiles.length === 0 ? (
              <div className="text-sm text-muted-foreground">プロファイルがありません。</div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border p-2">
                {profiles.map((name) => (
                  <div key={name} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted/40">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{name}</span>
                      {name === selectedProfile && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">選択中</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setProfileToDelete(name)}
                      aria-label={`プロファイル ${name} を削除`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {profileError && <p className="text-sm text-destructive">{profileError}</p>}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={profileToDelete !== null} onOpenChange={(open) => !open && setProfileToDelete(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>プロファイルの削除</DialogTitle>
          <DialogDescription>
            プロファイル「{profileToDelete}」を削除しますか？この操作は取り消せません。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setProfileToDelete(null)}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              if (profileToDelete) {
                await handleDeleteProfile(profileToDelete);
                setProfileToDelete(null);
              }
            }}
          >
            削除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
)
}

export default App

