export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-800">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <p>BotBili MVP</p>
        <p>© {year} BotBili. Built for AI creators.</p>
      </div>
    </footer>
  );
}
