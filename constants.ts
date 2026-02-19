import { CommandStep, InstallMethod } from './types';

export const INSTALL_STEPS: Record<InstallMethod, CommandStep[]> = {
  [InstallMethod.BINARY]: [
    {
      id: 'update',
      title: 'Update Termux',
      description: 'First, ensure your package lists and installed packages are up to date to avoid conflicts.',
      command: 'pkg update && pkg upgrade -y',
      explanation: 'This updates the package repository lists and upgrades installed software.'
    },
    {
      id: 'deps',
      title: 'Install Dependencies',
      description: 'We need wget to download the file and tar to extract it.',
      command: 'pkg install wget tar -y',
    },
    {
      id: 'download',
      title: 'Download Alist (ARM64)',
      description: 'Download the latest binary for Android ARM64 architecture (standard for most modern phones).',
      command: 'wget https://github.com/alist-org/alist/releases/latest/download/alist-linux-android-arm64.tar.gz',
      explanation: 'Fetches the latest compressed executable from the official GitHub repository.'
    },
    {
      id: 'extract',
      title: 'Extract Archive',
      description: 'Unpack the downloaded file.',
      command: 'tar -zxvf alist-linux-android-arm64.tar.gz',
    },
    {
      id: 'permission',
      title: 'Grant Execution Permissions',
      description: 'Make the binary executable.',
      command: 'chmod +x alist',
    },
    {
      id: 'run',
      title: 'Start Server',
      description: 'Launch the Alist server.',
      command: './alist server',
      explanation: 'This starts the server. You should see logs indicating the server is running on port 5244.'
    }
  ],
  [InstallMethod.SCRIPT]: [
    {
      id: 'update_script',
      title: 'Update Packages',
      description: 'Ensure system is ready.',
      command: 'pkg update && pkg upgrade -y',
    },
    {
      id: 'install_script',
      title: 'Run Install Script',
      description: 'Use the official one-click script (May require root in some environments, but worth trying).',
      command: 'curl -fsSL "https://alist.nn.ci/v3.sh" | bash -s install',
    }
  ]
};

export const POST_INSTALL_STEPS: CommandStep[] = [
  {
    id: 'password',
    title: 'Set Admin Password',
    description: 'Open a NEW session (swipe from left edge in Termux -> New Session) and run this to set your password.',
    command: './alist admin set 123456',
    explanation: 'Replace "123456" with your desired password. You cannot type this in the same terminal window where the server is running.'
  },
  {
    id: 'access',
    title: 'Access Alist',
    description: 'Open your browser.',
    command: 'http://127.0.0.1:5244',
    explanation: 'Copy this URL into your Chrome or generic browser.'
  }
];

export const SYSTEM_INSTRUCTION = `You are a helpful technical assistant specializing in Termux (Android Terminal) and Alist (File listing app). 
Your goal is to help users troubleshoot installation errors.
Common issues include:
- "Permission denied": Needs 'chmod +x alist' or storage permission 'termux-setup-storage'.
- "Port already in use": Alist is already running.
- Architecture mismatch: Using amd64 instead of arm64.
- Path issues: User not in the directory where they downloaded alist.

Keep answers concise and command-focused. Use Markdown for code blocks.`;