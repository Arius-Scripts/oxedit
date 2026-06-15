import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Search, WifiOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { useApp } from '@/stores/appStore';
import { readField } from '@/engine/editModel';
import type { DataFileName } from '@/services/fileSystem';
import { cn } from '@/lib/utils';

const RAW_BASE = 'https://raw.githubusercontent.com/bitc0de/fivem-items-gallery/main/';
const TREE_API = 'https://api.github.com/repos/bitc0de/fivem-items-gallery/git/trees/HEAD?recursive=1';

interface LibraryImage {
  path: string;  // full repo path, e.g. "images/weapons/weapon_pistol.png"
  name: string;  // just the filename, e.g. "weapon_pistol.png"
}

let _libraryCache: LibraryImage[] | null = null;

async function fetchLibraryList(): Promise<LibraryImage[]> {
  if (_libraryCache) return _libraryCache;
  const res = await fetch(TREE_API);
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data: { tree: { path: string; type: string }[] } = await res.json();
  _libraryCache = data.tree
    .filter((f) => f.type === 'blob' && f.path.startsWith('images/') && /\.(png|jpe?g|webp)$/i.test(f.path))
    .map((f) => ({ path: f.path, name: f.path.split('/').pop()! }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return _libraryCache;
}

export function ImagePickerModal({
  file,
  entryKey,
  imageName,
  onClose,
}: {
  file: DataFileName;
  entryKey: string;
  imageName: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'session' | 'library'>('session');
  const [query, setQuery] = useState('');
  const [libraryList, setLibraryList] = useState<LibraryImage[] | null>(null);
  const [libError, setLibError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [visibleCount, setVisibleCount] = useState(60);

  const sessionImages = useApp((s) => s.images);
  const addImages = useApp((s) => s.addImages);
  const editEntry = useApp((s) => s.editEntry);
  const model = useApp((s) => s.files[file]?.model);

  useEffect(() => {
    if (tab !== 'library' || libraryList !== null || libError) return;
    fetchLibraryList()
      .then(setLibraryList)
      .catch(() => setLibError(true));
  }, [tab]);

  useEffect(() => { setVisibleCount(60); }, [query]);

  const present = model ? !!readField(model, entryKey, 'client.image') : false;

  const applyImage = async (filename: string) => {
    await editEntry(file, entryKey, [
      { path: `${entryKey}.client.image`, value: filename, type: 'string', present },
    ]);
  };

  const pickSession = async (imgName: string) => {
    await applyImage(imgName);
    onClose();
  };

  const pickLibrary = async (img: LibraryImage) => {
    setBusy(true);
    try {
      const res = await fetch(RAW_BASE + img.path);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const f = new File([blob], img.name, { type: blob.type || 'image/png' });
      addImages([f]);
      await applyImage(img.name);
      toast.success(`Set image: ${img.name}`);
      onClose();
    } catch {
      toast.error('Failed to download image: check your connection');
    } finally {
      setBusy(false);
    }
  };

  const q = query.toLowerCase();
  const filteredSession = sessionImages.filter(
    (i) => !i.removed && (!q || i.name.toLowerCase().includes(q))
  );
  const filteredLibrary = (libraryList ?? []).filter(
    (img) => !q || img.name.toLowerCase().includes(q)
  );
  const displayedLibrary = filteredLibrary.slice(0, visibleCount);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-sm">
            Pick an image for <span className="font-mono text-primary">{entryKey}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Expected filename: <span className="font-mono">{imageName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="h-8 pl-8 text-xs"
              placeholder="Search images…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            <TabBtn active={tab === 'session'} onClick={() => setTab('session')}>
              Your images {sessionImages.filter((i) => !i.removed).length > 0 && `(${sessionImages.filter((i) => !i.removed).length})`}
            </TabBtn>
            <TabBtn active={tab === 'library'} onClick={() => setTab('library')}>
              Browse library
            </TabBtn>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {tab === 'session' ? (
            filteredSession.length === 0 ? (
              <Empty>
                {sessionImages.filter((i) => !i.removed).length === 0
                  ? 'No images in this session. Try "Browse library" to fetch from the FiveM items gallery.'
                  : 'No images match your search.'}
              </Empty>
            ) : (
              <ImageGrid>
                {filteredSession.map((img) => {
                  const url = img.optimizedUrl ?? img.url;
                  return (
                    <ImageCell
                      key={img.name}
                      name={img.name}
                      disabled={busy}
                      onClick={() => pickSession(img.name)}
                    >
                      <img
                        src={url}
                        alt={img.name}
                        className="icon-checker h-12 w-12 rounded object-contain"
                      />
                    </ImageCell>
                  );
                })}
              </ImageGrid>
            )
          ) : libError ? (
            <Empty>
              <WifiOff className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              Could not load the image library. Check your connection or try again later.
            </Empty>
          ) : libraryList === null ? (
            <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading library…
            </div>
          ) : filteredLibrary.length === 0 ? (
            <Empty>No images match your search.</Empty>
          ) : (
            <>
              <ImageGrid>
                {displayedLibrary.map((img) => (
                  <ImageCell
                    key={img.path}
                    name={img.name}
                    disabled={busy}
                    onClick={() => pickLibrary(img)}
                  >
                    <img
                      src={RAW_BASE + img.path}
                      alt={img.name}
                      loading="lazy"
                      className="icon-checker h-12 w-12 rounded object-contain"
                    />
                  </ImageCell>
                ))}
              </ImageGrid>
              {visibleCount < filteredLibrary.length && (
                <button
                  onClick={() => setVisibleCount((n) => n + 60)}
                  className="mt-4 w-full rounded-md border border-border py-2 text-xs text-muted-foreground hover:bg-accent"
                >
                  Load more ({filteredLibrary.length - visibleCount} remaining)
                </button>
              )}
            </>
          )}
        </div>

        {tab === 'library' && (
          <div className="border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">
            Images from{' '}
            <a
              href="https://github.com/bitc0de/fivem-items-gallery"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              bitc0de/fivem-items-gallery
            </a>
            . All credit to the original author.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'
      )}
    >
      {children}
    </button>
  );
}

function ImageGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
      {children}
    </div>
  );
}

function ImageCell({
  name,
  disabled,
  onClick,
  children,
}: {
  name: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={name}
      className="flex flex-col items-center gap-1 rounded-md border border-border p-2 text-center transition-colors hover:border-primary/50 hover:bg-accent disabled:opacity-50"
    >
      <div className="flex h-12 w-12 items-center justify-center">{children}</div>
      <span className="w-full truncate text-[10px] text-muted-foreground">{name}</span>
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">{children}</div>
  );
}
