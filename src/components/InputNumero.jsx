export default function InputNumero({ 
  label, 
  nome, 
  valor, 
  onChange, 
  placeholder, 
  step = "1",
  obrigatorio = true 
}) {
  return (
    <div className="flex flex-col w-full">
      {label && (
        <label className="mb-1 text-sm font-semibold text-gray-700">
          {label} {obrigatorio && <span className="text-red-500">*</span>}
        </label>
      )}
      <input 
        type="number" 
        name={nome}
        step={step} 
        value={valor} 
        onChange={onChange} 
        placeholder={placeholder}
        required={obrigatorio}
        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-gray-800 font-medium"
      />
    </div>
  );
}