export function ComplexPanel() {
  return (
    <div className="p-3 m-1.5 bg-white">
      <h2 className="text-slate-900 text-2xl mb-2.5">Complex Panel</h2>
      <p className="text-slate-400 bg-white mt-2">
        Hard to read text.
      </p>
      <div className="gap-2.5 mt-3.5 p-1">
        <button className="bg-red-600 text-white px-4 py-2">Delete</button>
        <button className="bg-blue-600 text-white px-6 py-2.5">Save</button>
        <button className="bg-green-600 text-white px-5 py-1.5">Export</button>
        <button className="bg-amber-500 text-white px-5 py-3">Archive</button>
      </div>
      <div className="gap-2 mt-5 p-0.5">
        <a className="text-indigo-600 bg-white" href="#">Learn more</a>
        <a className="text-purple-600 bg-white" href="#">Documentation</a>
      </div>
    </div>
  );
}
