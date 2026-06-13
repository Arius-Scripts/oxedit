import { MonacoEditor } from './MonacoLazy';

export function LivePreview({ source }: { source: string }) {
  return (
    <MonacoEditor
      height="100%"
      defaultLanguage="lua"
      theme="vs-dark"
      value={source}
      options={{
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 12,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        renderWhitespace: 'none',
        folding: true,
        automaticLayout: true,
      }}
    />
  );
}
