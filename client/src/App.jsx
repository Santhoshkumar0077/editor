import React, { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';

function App() {
  const [folderHandle, setFolderHandle] = useState(null);
  const [fileTree, setFileTree] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [content, setContent] = useState('');
  const [modified, setModified] = useState({});
  const [expandedDirs, setExpandedDirs] = useState({});
  const editorRef = useRef(null);

  const buildFileTree = async (dirHandle, currentPath = '') => {
    const children = [];
    for await (const entry of dirHandle.values()) {
      if (entry.name.startsWith('.')) continue; // Skip hidden files
      const entryPath = `${currentPath}/${entry.name}`;
      if (entry.kind === 'directory') {
        children.push({
          name: entry.name,
          path: entryPath,
          isDir: true,
          handle: entry,
          children: [], // placeholder for dynamic loading
        });
      } else {
        children.push({
          name: entry.name,
          path: entryPath,
          isDir: false,
          handle: entry,
        });
      }
    }
    return children;
  };

  const openFolder = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker();
      const tree = await buildFileTree(dirHandle);
      setFolderHandle(dirHandle);
      setFileTree(tree);
      setSelectedFile(null);
      setContent('');
      setModified({});
      setExpandedDirs({});
    } catch (err) {
      console.error('Folder access cancelled or failed', err);
    }
  };

  const openFile = async (fileHandle) => {
    try {
      const file = await fileHandle.getFile();
      const text = await file.text();
      setSelectedFile(fileHandle);
      setContent(text);
    } catch (err) {
      console.error('Error opening file', err);
    }
  };

  const saveFile = useCallback(async () => {
    if (!selectedFile) return;
    try {
      editorRef.current?.getAction('editor.action.formatDocument')?.run();
      const writable = await selectedFile.createWritable();
      await writable.write(content);
      await writable.close();
      setModified(prev => ({ ...prev, [selectedFile.name]: false }));
    } catch (err) {
      console.error('Error saving file', err);
    }
  }, [selectedFile, content]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveFile]);

  const expandDirectory = async (entry) => {
    if (!entry.isDir || entry.children?.length > 0) return;

    const children = await buildFileTree(entry.handle, entry.path);
    entry.children = children;
    setFileTree(prev => [...prev]); // trigger rerender
  };

  const toggleDirectory = async (entry) => {
    const path = entry.path;
    const isExpanded = expandedDirs[path];

    if (!isExpanded) {
      await expandDirectory(entry);
    }

    setExpandedDirs(prev => ({
      ...prev,
      [path]: !isExpanded
    }));
  };

  const renderTree = (entries, depth = 0) => {
    return entries.map(entry => {
      const isExpanded = expandedDirs[entry.path];
      const isSelected = selectedFile?.name === entry.name;
      const isModified = modified[entry.name];
      return (
        <div key={entry.path}>
          <div
            className={`pl-${depth * 4} flex items-center select-none ${
              isSelected ? 'bg-blue-600 text-white rounded-md' : 'text-gray-800 hover:bg-gray-200 rounded-md cursor-pointer'
            }`}
            onClick={() => (entry.isDir ? toggleDirectory(entry) : openFile(entry.handle))}
          >
            <span className="mr-2">
              {entry.isDir ? (isExpanded ? '📂' : '📁') : '📄'}
            </span>
            <span className="flex-1 truncate">{entry.name}{isModified ? '*' : ''}</span>
          </div>
          {entry.isDir && isExpanded && entry.children?.length > 0 && (
            <div className="ml-4">
              {renderTree(entry.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-300 flex flex-col">
        <button
          onClick={openFolder}
          className="m-4 mb-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-md transition"
        >
          Open Folder
        </button>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {fileTree.length > 0 ? renderTree(fileTree) : (
            <p className="text-gray-500 text-center mt-10 select-none">No folder opened</p>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex flex-col flex-grow">
        <div className="flex items-center justify-between border-b border-gray-300 px-4 py-2 bg-white shadow-sm">
          <button
            onClick={saveFile}
            disabled={!selectedFile}
            className={`px-4 py-2 rounded-md font-semibold transition ${
              selectedFile
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-md'
                : 'bg-gray-300 text-gray-600 cursor-not-allowed'
            }`}
          >
            Save (Ctrl+S)
          </button>
          {selectedFile && (
            <span className="ml-4 text-gray-700 truncate max-w-xs">{selectedFile.name}</span>
          )}
        </div>
        <div className="flex-grow">
          {selectedFile ? (
            <Editor
              height="100%"
              defaultLanguage={selectedFile.name.split('.').pop()}
              theme="vs-dark"
              value={content}
              onMount={(editor, monaco) => {
                editorRef.current = editor;
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
                  editor.getAction('editor.action.formatDocument').run();
                });
              }}
              onChange={value => {
                setContent(value);
                setModified(prev => ({ ...prev, [selectedFile.name]: true }));
              }}
              options={{
                automaticLayout: true,
                autoClosingBrackets: 'always',
                formatOnType: true,
                formatOnPaste: true,
                tabSize: 2,
                minimap: { enabled: false },
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 select-none text-lg">
              Open a file to start editing
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
