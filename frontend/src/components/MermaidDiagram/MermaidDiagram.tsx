// frontend/src/components/MermaidDiagram/MermaidDiagram.tsx
import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current || !chart) return;

      try {
        setError(null);
        
        // Reset mermaid
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: 'Inter, sans-serif',
          sequence: {
            diagramMarginX: 50,
            diagramMarginY: 10,
            actorMargin: 50,
            width: 150,
            height: 65,
            boxMargin: 10,
            boxTextMargin: 5,
            noteMargin: 10,
            messageMargin: 35,
            mirrorActors: true,
            useMaxWidth: true,
          },
        });

        // Render
        const { svg } = await mermaid.render('mermaid-diagram', chart);
        containerRef.current.innerHTML = svg;
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Lỗi hiển thị sơ đồ');
        containerRef.current.innerHTML = `
          <div style="color: #ef4444; padding: 1rem; text-align: center;">
            <p>❌ Lỗi hiển thị sơ đồ</p>
            <pre style="font-size: 12px; text-align: left; background: #1e293b; padding: 0.5rem; border-radius: 4px; overflow: auto; max-height: 200px; color: #e2e8f0;">
              ${chart}
            </pre>
            <p style="font-size: 12px; color: #ef4444; margin-top: 0.5rem;">${error}</p>
          </div>
        `;
      }
    };

    renderDiagram();
  }, [chart]);

  return (
    <div 
      ref={containerRef} 
      className="mermaid"
      style={{ 
        width: '100%', 
        minHeight: '200px',
        background: 'white',
        padding: '1rem',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  );
};

export default MermaidDiagram;