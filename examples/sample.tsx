export function DangerPanel() {
  return (
    <div className="p-3 m-5 bg-white">
      <h2 className="text-slate-900 text-2xl mb-3">Account settings</h2>
      <p className="text-slate-400 bg-white mt-1.5">
        Subtle helper text that is hard to read.
      </p>
      <div className="gap-2.5 mt-4 p-2">
        <button className="bg-red-600 text-white px-4 py-2">Delete data</button>
        <button className="bg-blue-600 text-white px-4 py-2">Save</button>
        <button className="bg-green-600 text-white px-4 py-2">Export</button>
        <button className="bg-amber-500 text-white px-4 py-2">Archive</button>
        <a className="text-indigo-600 bg-white" href="#">Learn more</a>
      </div>
    </div>
  );
}
