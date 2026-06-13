import { Suspense, lazy, type ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';

// Monaco is heavy (~hundreds of KB). Load it only when an editor/preview is
// actually rendered so the landing and list views paint fast.
const Editor = lazy(() => import('@monaco-editor/react'));

function EditorFallback() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  );
}

export function MonacoEditor(props: ComponentProps<typeof Editor>) {
  return (
    <Suspense fallback={<EditorFallback />}>
      <Editor {...props} />
    </Suspense>
  );
}
