// Plano de Manutenção Programada do motor 1.3 16V Turbo Flex.
// Fonte: manual do proprietário Jeep Compass 2023, capítulo H (págs. H-1 a H-6) e I (I-9, I-14, I-16).
//
// Como cada item é calculado:
//   every: n  -> acontece a cada n revisões (n x 12.000 km ou n x 12 meses)
//   base 'unknown' -> a última execução não é conhecida até ser registrada
//   base 'start'   -> conta desde o início de uso do carro
//   base 'setup'   -> conta a partir do cadastro no app
//   severe: true   -> prazo reduzido à metade em utilização severa (H-2)

export const REV_KM = 12000;
export const REV_MONTHS = 12;
export const TOLERANCE_KM = 1000;
export const TOLERANCE_DAYS = 30;

export const PLAN = [
  { id: 'oil', name: 'Óleo do motor e filtro de óleo', kind: 'Troca', every: 1, severe: true, ref: 'H-2, H-4',
    note: 'Óleo 0W30 totalmente sintético, ACEA C2, qualificação 9.55535-GS1 (Mopar MaxPro Synthetic 0W30). 4,8 L com filtro.' },
  { id: 'fuelFilter', name: 'Filtro de combustível', kind: 'Troca', every: 1, ref: 'H-4' },
  { id: 'airFilter', name: 'Filtro de ar do motor', kind: 'Troca', every: 2, ref: 'H-4',
    note: 'Trocado nas revisões pares e verificado nas ímpares.' },
  { id: 'cabinFilter', name: 'Filtro do ar-condicionado', kind: 'Verificação', every: 1, ref: 'H-5' },
  { id: 'general', name: 'Verificações gerais da revisão', kind: 'Verificação', every: 1, ref: 'H-4, H-5',
    note: 'Níveis de fluidos, pastilhas de freio (trocar abaixo de 5 mm), palhetas, cintos, vidros, parte elétrica, bateria, tubulações, borrachas, pneus, suspensão, direção, homocinéticas, teto solar e diagnóstico de injeção/ignição.' },
  { id: 'beltCheck', name: 'Correias de acessórios (verificação)', kind: 'Verificação', every: 2, ref: 'H-5' },
  { id: 'parkBrake', name: 'Freio de estacionamento elétrico', kind: 'Verificação', every: 3, ref: 'H-5' },
  { id: 'emissions', name: 'Emissões e sistema evaporativo', kind: 'Verificação', every: 4, ref: 'H-5' },
  { id: 'prv', name: 'Válvula PRV', kind: 'Verificação', every: 10, ref: 'H-6',
    note: 'Inspecionar e, se necessário, substituir.' },
  { id: 'brakeFluid', name: 'Fluido de freio', kind: 'Troca', km: 36000, months: 24, base: 'unknown', ref: 'H-5',
    note: 'DOT 4 (Mopar DOT 4S). A cada 24 meses ou 36.000 km, o que ocorrer primeiro. Registre a última troca para o app calcular o prazo.' },
  { id: 'plugs', name: 'Velas de ignição', kind: 'Troca', km: 60000, base: 'start', ref: 'H-6',
    note: 'A cada 60.000 km, independente do tempo.' },
  { id: 'belts', name: 'Correias de acessórios (troca)', kind: 'Troca', km: 120000, months: 72, base: 'start', ref: 'H-5',
    note: 'Na 10ª revisão ou em 6 anos, o que ocorrer primeiro.' },
  { id: 'coolant', name: 'Líquido de arrefecimento', kind: 'Troca', km: 240000, months: 120, base: 'start', ref: 'H-6',
    note: 'Mopar Coolant OAT 50, sem diluição. 8 L no sistema.' },
  { id: 'levels', name: 'Níveis, pneus, luzes e palhetas', kind: 'Você mesmo', km: 1000, base: 'setup', owner: true, ref: 'H-1',
    note: 'A cada 1.000 km ou antes de viagens longas: arrefecimento, freios, lavador, pressão e estado dos pneus, iluminação e limpadores.' },
  { id: 'oilLevel', name: 'Nível de óleo do motor', kind: 'Você mesmo', km: 3000, base: 'setup', owner: true, ref: 'H-1',
    note: 'A cada 3.000 km. Motor frio, nível entre MÍN e MÁX na vareta, nunca acima do MÁX.' },
];

export const SPECS = [
  ['Óleo do motor', '0W30 sintético ACEA C2 · 9.55535-GS1'],
  ['Volume de óleo', '4,8 L com filtro · 4,5 L só cárter'],
  ['Tanque', '55 L (reserva de 8 L)'],
  ['Pneus (frio)', '35 psi dianteiros · 32 psi traseiros'],
  ['Pressão econômica', '38 psi dianteiros e traseiros'],
  ['Estepe', '60 psi'],
  ['Fluido de freio', 'DOT 4 · Mopar DOT 4S'],
  ['Arrefecimento', 'Mopar Coolant OAT 50 · 8 L'],
  ['Câmbio automático', 'For Life, sem troca prevista'],
];

// Ficha técnica do Compass Limited T270 (não consta no manual).
export const FUEL_REFERENCE = {
  gasolina: { cidade: 10.4, estrada: 12.1 },
  etanol: { cidade: 7.1, estrada: 8.8 },
};

export const FUELS = [['gasolina', 'Gasolina'], ['etanol', 'Etanol']];
export const EXPENSE_CATS = ['IPVA', 'Licenciamento', 'Seguro', 'Multa', 'Lavagem', 'Estacionamento', 'Pedágio', 'Pneus', 'Outros'];
