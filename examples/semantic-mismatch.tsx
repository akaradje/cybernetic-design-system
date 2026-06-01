export function MismatchPanel() {
  return (
    <div className="p-4 m-5 bg-white">
      <h2 className="text-slate-900 text-2xl mb-3">Account settings</h2>
      <p className="text-slate-400 bg-white">
        Subtle helper text that is hard to read.
      </p>
      <div className="gap-4 mt-4 p-2">
        <button className="bg-blue-600 text-white px-4 py-2">Delete all data</button>
        <button className="bg-red-600 text-white px-4 py-2">Save changes</button>
        <button className="bg-gray-400 text-white px-4 py-2">Export report</button>
        <a className="text-gray-500 bg-white" href="#">Learn more</a>
      </div>
    </div>
  );
}
