import { useState } from 'react';
import MermaidDiagram from './MermaidDiagram';

function UMLGenerator() {
  const [input, setInput] = useState('');
  const [spec, setSpec] = useState('');
  const [useCaseDiagram, setUseCaseDiagram] = useState('');
  const [classDiagram, setClassDiagram] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/uml/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          description: input,
          language: 'vi'
        })
      });

      const data = await res.json();
      
      setSpec(data.use_case_spec);
      setUseCaseDiagram(data.use_case_diagram);
      setClassDiagram(data.class_diagram);
    } catch (err) {
      alert("Lỗi kết nối backend: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">GenAI UML Assistant</h1>
      
      <textarea
        className="w-full h-32 p-4 border rounded-lg mb-4"
        placeholder="Mô tả yêu cầu hệ thống bằng tiếng Việt..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <button
        onClick={generate}
        disabled={loading}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Đang sinh..." : "Sinh UML & Use Case"}
      </button>

      {spec && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-2">Use Case Specification</h2>
          <pre className="bg-gray-100 p-4 rounded-lg whitespace-pre-wrap">{spec}</pre>
        </div>
      )}

      {useCaseDiagram && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-2">Use Case Diagram</h2>
          <MermaidDiagram chart={useCaseDiagram} />
        </div>
      )}

      {classDiagram && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-2">Conceptual Class Diagram</h2>
          <MermaidDiagram chart={classDiagram} />
        </div>
      )}
    </div>
  );
}

export default UMLGenerator;