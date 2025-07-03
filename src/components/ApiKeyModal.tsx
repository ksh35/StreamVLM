import React, { useState, useEffect } from 'react';

export const ApiKeyModal: React.FC<{ open: boolean, onClose: () => void }> = ({ open, onClose }) => {
  const [openai, setOpenai] = useState('');
  const [anthropic, setAnthropic] = useState('');
  const [google, setGoogle] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [keyStatus, setKeyStatus] = useState<{openai: boolean, anthropic: boolean, google: boolean}>({openai: false, anthropic: false, google: false});

  useEffect(() => {
    if (open) {
      fetch('/api/keys-status')
        .then(res => res.json())
        .then(data => setKeyStatus(data));
    }
  }, [open]);

  const handleSave = async () => {
    setStatus('Saving...');
    const res = await fetch('/api/save-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        openai_key: openai,
        anthropic_key: anthropic,
        google_key: google,
      }),
    });
    if (res.ok) {
      setStatus('Saved!');
      setTimeout(onClose, 1000);
    } else {
      setStatus('Error saving keys');
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">Enter API Keys</h2>
        <label className="block mb-2 text-sm">OpenAI API Key {keyStatus.openai && <span className="text-green-600 ml-2">(Set)</span>}</label>
        <input className="input-field mb-4" value={openai} onChange={e => setOpenai(e.target.value)} placeholder="sk-..." />
        <label className="block mb-2 text-sm">Anthropic API Key {keyStatus.anthropic && <span className="text-green-600 ml-2">(Set)</span>}</label>
        <input className="input-field mb-4" value={anthropic} onChange={e => setAnthropic(e.target.value)} placeholder="..." />
        <label className="block mb-2 text-sm">Google API Key {keyStatus.google && <span className="text-green-600 ml-2">(Set)</span>}</label>
        <input className="input-field mb-4" value={google} onChange={e => setGoogle(e.target.value)} placeholder="..." />
        <div className="flex gap-2 mt-4">
          <button className="btn-primary" onClick={handleSave}>Save</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
        {status && <div className="mt-2 text-xs text-gray-500">{status}</div>}
      </div>
    </div>
  );
}; 