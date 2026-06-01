export function TestPanel() {
  return (
    <div className="p-3 m-1.5 bg-white">
      <h2 className="text-slate-900 text-2xl mb-2.5">Test Panel</h2>
      <p className="text-slate-400 bg-white mt-2">
        Hard to read text.
      </p>
      <div className="gap-2.5 mt-3.5 p-1">
        <button className="bg-red-600 text-white px-4 py-2">Action</button>
      </div>
    </div>
  );
}
