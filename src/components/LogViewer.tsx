import React, { useState, useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Filter } from "lucide-react";

interface LogViewerProps {
    logs: LogEntry[];
    onClear: () => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs, onClear }) => {
    const [filter, setFilter] = useState<string>('all');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const filteredLogs = logs.filter(log => {
        if (filter === 'all') return true;
        return log.level === filter;
    });

    return (
        <div className="border rounded-lg bg-card text-card-foreground shadow-sm mt-8">
            <div className="p-4 border-b flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        System Logs
                    </h3>
                    <div className="flex gap-1 ml-4">
                        {['all', 'rx', 'tx', 'error'].map(f => (
                            <Button
                                key={f}
                                variant={filter === f ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setFilter(f)}
                                className="h-6 text-xs capitalize"
                            >
                                {f}
                            </Button>
                        ))}
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClear} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
            <ScrollArea className="h-[200px] w-full rounded-b-lg border-b">
                <div className="p-4 space-y-1.5">
                    {filteredLogs.length === 0 && (
                        <div className="text-center text-muted-foreground text-xs py-8">
                            No logs to display
                        </div>
                    )}
                    {filteredLogs.map((log, i) => (
                        <div key={i} className="text-xs font-mono flex gap-2 items-start">
                            <span className="text-muted-foreground min-w-[80px] shrink-0">
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <Badge
                                variant="outline"
                                className={`
                                    w-14 justify-center uppercase text-[10px] h-5 shrink-0
                                    ${log.level === 'error' ? 'border-destructive text-destructive bg-destructive/5' : ''}
                                    ${log.level === 'rx' ? 'border-green-500 text-green-500 bg-green-500/5' : ''}
                                    ${log.level === 'tx' ? 'border-blue-500 text-blue-500 bg-blue-500/5' : ''}
                                `}
                            >
                                {log.level}
                            </Badge>
                            <span className="break-all whitespace-pre-wrap">{log.message}</span>
                        </div>
                    ))}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>
        </div>
    );
};
