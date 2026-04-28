# Local Port Manager

Local Port Manager is a Windows desktop app for managing local development servers and occupied ports.

It helps keep multiple local sites under control from one place: add projects, start or stop dev servers, restart them, scan occupied localhost ports, open a running site in the browser, and stop a process that is holding a port.

## Features

- Russian interface by default, with English available in settings.
- Project list with folder, port, and start command.
- Start, stop, and restart managed development servers.
- Automatic scan of occupied local ports.
- Display of port, PID, process name, and server logs.
- Open local sites in the browser.
- Stop a process that is occupying a port.
- `{port}` placeholder support in commands, for example:

```bash
npm run dev -- --host 127.0.0.1 --port {port}
```

## Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm start
```

Build a portable Windows executable:

```bash
npm run build
```

The built executable is created in `dist/`.

## Notes

The app uses Windows networking and process tools to detect listening local ports and stop selected processes.
