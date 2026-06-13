import Editor from '@monaco-editor/react';

export function LivePreview({ source }: { source: string }) {
  return (
    <Editor
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
