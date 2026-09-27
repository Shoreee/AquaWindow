declare module '*.json' {
  const value: { id: string; title: string; goal: string; steps: string[] };
  export default value;
}
