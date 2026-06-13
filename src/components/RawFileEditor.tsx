import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import { Button } from './ui/button';
import { useApp } from '@/stores/appStore';
import type { DataFileName } from '@/services/fileSystem';

export function RawFileEditor({ file }: { file: DataFileName }) {
  const current = useApp((s) => s.files[file]?.current ?? '');
  const setRaw = useApp((s) => s.setRawSource);
  const [draft, setDraft] = useState(current);

  useEffect(() => setDraft(current), [current, file]);

  const dirty = draft !== current;

  const save = async () => {
    const ok = await setRaw(file, draft);
    if (ok) toast.success('Applied');
    else toast.error('Lua parse error — not applied');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs text-muted-foreground">Raw editor — {file}.lua</span>
        <Button size="sm" disabled={!dirty} onClick={save}>
          <Save /> Apply
        </Button>
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          defaultLanguage="lua"
          theme="vs-dark"
          value={draft}
          onChange={(v) => setDraft(v ?? '')}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
