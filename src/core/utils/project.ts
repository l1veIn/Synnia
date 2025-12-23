import { SynniaNode, SynniaEdge } from '@/types/project';

export const saveProjectToFile = (nodes: SynniaNode[], edges: SynniaEdge[]) => {
    const projectData = {
      version: '1.0.0',
      timestamp: Date.now(),
      nodes,
      edges,
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `synnia-workflow-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
