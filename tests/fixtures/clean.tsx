/** Clean component — passes all CDS checks. */
export function CleanPanel() {
  return (
    <div className="p-4 m-4 bg-white">
      <h2 className="text-slate-900 text-2xl mb-4">Settings</h2>
      <p className="text-slate-700">
        Configure your account preferences below.
      </p>
      <div className="gap-4 mt-4">
        <button className="bg-blue-600 text-white px-4 py-2">Save</button>
        <button className="bg-slate-200 text-slate-800 px-4 py-2">Cancel</button>
      </div>
    </div>
  );
}
