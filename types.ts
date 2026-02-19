export interface CommandStep {
  id: string;
  title: string;
  description: string;
  command: string;
  explanation?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

export enum InstallMethod {
  BINARY = 'BINARY',
  SCRIPT = 'SCRIPT'
}