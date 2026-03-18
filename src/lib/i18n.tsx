import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type Locale = 'en' | 'uk';

const STORAGE_KEY = 'promin_lang';

const en: Record<string, string> = {
  // Header
  'header.running': 'Running',
  'header.optimizing': 'Optimizing',
  'header.done': 'Done',
  'header.workflow.optimizing': 'Optimizing',
  'header.workflow.simulating': 'Simulating',
  'header.workflow.review': 'Review Results',
  'header.workflow.configure': 'Configure',

  // Theme
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',

  // Sidebar sections
  'sidebar.inputs': 'Project Inputs',
  'sidebar.presets': 'Frequency Presets',
  'sidebar.optimization': 'Optimization',
  'sidebar.importCad': 'Import CAD',
  'sidebar.solver': 'EM Solver',

  // Tabs
  'tab.sParams': 'S-Parameters',
  'tab.impedance': 'Impedance',
  'tab.vswr': 'VSWR',
  'tab.zFreq': 'Z(f)',
  'tab.3d': '3D View',
  'tab.radiation': 'Radiation',
  'tab.history': 'History',
  'tab.mesh': 'Mesh',

  // Stat cards
  'stat.resonantFreq': 'Resonant Freq',
  'stat.minS11': 'Min S11',
  'stat.vswr': 'VSWR',
  'stat.bw': 'BW (-10 dB)',

  // Empty state
  'empty.title': 'No Simulation Data',
  'empty.text': 'Configure antenna parameters in the sidebar and run a simulation',
  'empty.types': '31 antenna types available',

  // Landing page
  'landing.subtitle': 'Antenna Engineering Workspace',
  'landing.title': 'Design, simulate and analyze antennas in one flow.',
  'landing.desc': 'A calmer, tool-first interface for rapid antenna iteration. Start from presets, run sweeps, inspect S-parameters and move to export without jumping between disconnected screens.',
  'landing.openWorkspace': 'Open Workspace',
  'landing.docs': 'Documentation',
  'landing.sessionOverview': 'Session Overview',
  'landing.antennaTypes': 'Antenna Types',
  'landing.sweepPoints': 'Sweep Points',
  'landing.3dView': '3D View',
  'landing.export': 'Export',
  'landing.enabled': 'Enabled',
  'landing.touchstone': 'Touchstone/CSV',
  'landing.step1.title': '1. Configure',
  'landing.step1.text': 'Select an antenna family, edit parameters and apply frequency presets.',
  'landing.step2.title': '2. Simulate',
  'landing.step2.text': 'Run sweep or optimization and monitor progress from the top status bar.',
  'landing.step3.title': '3. Analyze & Export',
  'landing.step3.text': 'Review S11, Smith, 3D and radiation tabs, then export results.',

  // AntennaForm
  'form.antennaType': 'Antenna Type',
  'form.frequency': 'Frequency',
  'form.length': 'Length',
  'form.radius': 'Radius',
  'form.width': 'Width',
  'form.subHeight': 'Sub. Height',
  'form.material': 'Material',
  'form.copper': 'Copper',
  'form.aluminum': 'Aluminum',
  'form.silver': 'Silver',
  'form.brass': 'Brass',
  'form.kbParams': 'KB Parameters',
  'form.runSimulation': 'Run Simulation',
  'form.simulating': 'Simulating...',

  // Solver panel
  'solver.config': 'Solver Configuration',
  'solver.type': 'Solver Type',
  'solver.meshResolution': 'Mesh Resolution',
  'solver.elementsPerWl': 'Elements per wavelength:',
  'solver.frequency': 'Frequency',
  'solver.singleFreq': 'Single Frequency',
  'solver.freqSweep': 'Frequency Sweep',
  'solver.presetBand': 'Preset Band',
  'solver.center': 'Center:',
  'solver.fromConfig': '(from antenna config)',
  'solver.range': 'Range:',
  'solver.sweepWidth': 'Sweep width:',
  'solver.points': 'Points:',
  'solver.band': 'Band:',
  'solver.options': 'Solver Options',
  'solver.linearSolver': 'Linear Solver:',
  'solver.luDecomp': 'LU Decomposition',
  'solver.tolerance': 'Tolerance:',
  'solver.maxIter': 'Max Iterations:',
  'solver.comparisonMode': 'Comparison Mode (MoM vs FDTD)',
  'solver.runSolver': 'Run Solver',
  'solver.running': 'Running...',
  'solver.cancel': 'Cancel',
  'solver.comparisonResults': 'Comparison Results',
  'solver.simResults': 'Simulation Results',
  'solver.sweepSummary': 'Sweep Summary',
  'solver.freqPointsComputed': 'frequency points computed',
  'solver.totalTime': 'Total time:',
  'solver.converged': 'Converged:',
  'solver.yes': 'Yes',
  'solver.no': 'No',

  // Radiation pattern
  'radiation.title': '3D Radiation Pattern',
  'radiation.maxGain': 'Max Gain:',
  'radiation.wireframe': 'Wireframe',
  'radiation.refresh': 'Refresh',
  'radiation.computing': 'Computing...',
  'radiation.computingPattern': 'Computing radiation pattern...',
  'radiation.noData': 'No pattern data',
  'radiation.highGain': 'High Gain',
  'radiation.mid': 'Mid',
  'radiation.lowGain': 'Low Gain',

  // Export panel
  'export.s1p': 'Export S1P',
  'export.csv': 'Export CSV',
  'export.pdf': 'Export PDF',
  'export.generating': 'Generating...',
  'export.s1pFormat': 'S1P Format',
  'export.freqUnit': 'Frequency Unit',
  'export.ri': 'Real/Imaginary',
  'export.ma': 'Magnitude/Angle',
  'export.dbAngle': 'dB/Angle',

  // Simulation history
  'history.title': 'Simulation History',
  'history.clearAll': 'Clear All',
  'history.empty': 'No simulation history.',
  'history.emptyHint': 'Run a simulation to see it here.',
  'history.load': 'Load',

  // Optimization panel
  'opt.freqMhz': 'Freq (MHz)',
  'opt.s11Db': 'S11 (dB)',
  'opt.method': 'Method',
  'opt.gradient': 'Gradient',
  'opt.random': 'Random',
  'opt.nelderMead': 'Nelder-Mead',
  'opt.optimize': 'Optimize',
  'opt.stop': 'Stop',
  'opt.progress': 'Progress',
  'opt.best': 'Best:',

  // File import
  'import.title': 'Import CAD File',
  'import.supports': 'Supports: STL, NEC, NASTRAN, STEP',
  'import.importing': 'Importing',
  'import.complete': 'complete',
  'import.dropHere': 'Drop your CAD file here',
  'import.or': 'or',
  'import.browseFiles': 'browse files',
  'import.success': 'Import Successful',
  'import.vertices': 'Vertices',
  'import.triangles': 'Triangles',
  'import.segments': 'Segments',
  'import.recentImports': 'Recent Imports',
};

const uk: Record<string, string> = {
  // Header
  'header.running': 'Виконання',
  'header.optimizing': 'Оптимізація',
  'header.done': 'Готово',
  'header.workflow.optimizing': 'Оптимізація',
  'header.workflow.simulating': 'Моделювання',
  'header.workflow.review': 'Перегляд результатів',
  'header.workflow.configure': 'Налаштування',

  // Theme
  'theme.light': 'Світла',
  'theme.dark': 'Темна',
  'theme.system': 'Системна',

  // Sidebar sections
  'sidebar.inputs': 'Параметри проєкту',
  'sidebar.presets': 'Пресети частот',
  'sidebar.optimization': 'Оптимізація',
  'sidebar.importCad': 'Імпорт CAD',
  'sidebar.solver': 'EM Солвер',

  // Tabs
  'tab.sParams': 'S-параметри',
  'tab.impedance': 'Імпеданс',
  'tab.vswr': 'КСХН',
  'tab.zFreq': 'Z(f)',
  'tab.3d': '3D вигляд',
  'tab.radiation': 'Випромінювання',
  'tab.history': 'Історія',
  'tab.mesh': 'Сітка',

  // Stat cards
  'stat.resonantFreq': 'Резонансна частота',
  'stat.minS11': 'Мін. S11',
  'stat.vswr': 'КСХН',
  'stat.bw': 'Смуга (-10 дБ)',

  // Empty state
  'empty.title': 'Немає даних моделювання',
  'empty.text': 'Налаштуйте параметри антени на бічній панелі та запустіть моделювання',
  'empty.types': '31 тип антен доступний',

  // Landing page
  'landing.subtitle': 'Робочий простір антенної інженерії',
  'landing.title': 'Проєктуйте, моделюйте та аналізуйте антени в одному потоці.',
  'landing.desc': 'Зручний інтерфейс для швидкої ітерації антен. Починайте з пресетів, запускайте розгортки, перевіряйте S-параметри та експортуйте результати без перемикання між екранами.',
  'landing.openWorkspace': 'Відкрити робочий простір',
  'landing.docs': 'Документація',
  'landing.sessionOverview': 'Огляд сесії',
  'landing.antennaTypes': 'Типи антен',
  'landing.sweepPoints': 'Точок розгортки',
  'landing.3dView': '3D вигляд',
  'landing.export': 'Експорт',
  'landing.enabled': 'Увімкнено',
  'landing.touchstone': 'Touchstone/CSV',
  'landing.step1.title': '1. Налаштувати',
  'landing.step1.text': 'Оберіть тип антени, змініть параметри та застосуйте пресети частот.',
  'landing.step2.title': '2. Змоделювати',
  'landing.step2.text': 'Запустіть розгортку або оптимізацію та слідкуйте за прогресом у статус-барі.',
  'landing.step3.title': '3. Аналіз та експорт',
  'landing.step3.text': 'Перегляньте S11, Сміта, 3D та діаграми випромінювання, потім експортуйте.',

  // AntennaForm
  'form.antennaType': 'Тип антени',
  'form.frequency': 'Частота',
  'form.length': 'Довжина',
  'form.radius': 'Радіус',
  'form.width': 'Ширина',
  'form.subHeight': 'Висота підкл.',
  'form.material': 'Матеріал',
  'form.copper': 'Мідь',
  'form.aluminum': 'Алюміній',
  'form.silver': 'Срібло',
  'form.brass': 'Латунь',
  'form.kbParams': 'KB Параметри',
  'form.runSimulation': 'Запустити моделювання',
  'form.simulating': 'Моделювання...',

  // Solver panel
  'solver.config': 'Налаштування солвера',
  'solver.type': 'Тип солвера',
  'solver.meshResolution': 'Роздільність сітки',
  'solver.elementsPerWl': 'Елементів на довжину хвилі:',
  'solver.frequency': 'Частота',
  'solver.singleFreq': 'Одна частота',
  'solver.freqSweep': 'Розгортка частот',
  'solver.presetBand': 'Пресет діапазону',
  'solver.center': 'Центр:',
  'solver.fromConfig': '(з налаштувань антени)',
  'solver.range': 'Діапазон:',
  'solver.sweepWidth': 'Ширина розгортки:',
  'solver.points': 'Точок:',
  'solver.band': 'Діапазон:',
  'solver.options': 'Параметри солвера',
  'solver.linearSolver': 'Лінійний солвер:',
  'solver.luDecomp': 'LU-розклад',
  'solver.tolerance': 'Точність:',
  'solver.maxIter': 'Макс. ітерацій:',
  'solver.comparisonMode': 'Режим порівняння (MoM vs FDTD)',
  'solver.runSolver': 'Запустити солвер',
  'solver.running': 'Виконання...',
  'solver.cancel': 'Скасувати',
  'solver.comparisonResults': 'Результати порівняння',
  'solver.simResults': 'Результати моделювання',
  'solver.sweepSummary': 'Підсумок розгортки',
  'solver.freqPointsComputed': 'частотних точок обчислено',
  'solver.totalTime': 'Загальний час:',
  'solver.converged': 'Збіжність:',
  'solver.yes': 'Так',
  'solver.no': 'Ні',

  // Radiation pattern
  'radiation.title': '3D діаграма випромінювання',
  'radiation.maxGain': 'Макс. підсилення:',
  'radiation.wireframe': 'Каркас',
  'radiation.refresh': 'Оновити',
  'radiation.computing': 'Обчислення...',
  'radiation.computingPattern': 'Обчислення діаграми випромінювання...',
  'radiation.noData': 'Немає даних',
  'radiation.highGain': 'Високе підсилення',
  'radiation.mid': 'Середнє',
  'radiation.lowGain': 'Низьке підсилення',

  // Export panel
  'export.s1p': 'Експорт S1P',
  'export.csv': 'Експорт CSV',
  'export.pdf': 'Експорт PDF',
  'export.generating': 'Генерується...',
  'export.s1pFormat': 'Формат S1P',
  'export.freqUnit': 'Одиниця частоти',
  'export.ri': 'Re/Im',
  'export.ma': 'Модуль/Кут',
  'export.dbAngle': 'дБ/Кут',

  // Simulation history
  'history.title': 'Історія моделювань',
  'history.clearAll': 'Очистити все',
  'history.empty': 'Історія моделювань порожня.',
  'history.emptyHint': 'Запустіть моделювання, щоб побачити його тут.',
  'history.load': 'Завантажити',

  // Optimization panel
  'opt.freqMhz': 'Частота (МГц)',
  'opt.s11Db': 'S11 (дБ)',
  'opt.method': 'Метод',
  'opt.gradient': 'Градієнтний',
  'opt.random': 'Випадковий',
  'opt.nelderMead': 'Нелдера-Міда',
  'opt.optimize': 'Оптимізувати',
  'opt.stop': 'Зупинити',
  'opt.progress': 'Прогрес',
  'opt.best': 'Найкращий:',

  // File import
  'import.title': 'Імпорт CAD файлу',
  'import.supports': 'Підтримка: STL, NEC, NASTRAN, STEP',
  'import.importing': 'Імпорт',
  'import.complete': 'завершено',
  'import.dropHere': 'Перетягніть CAD файл сюди',
  'import.or': 'або',
  'import.browseFiles': 'оберіть файл',
  'import.success': 'Імпорт успішний',
  'import.vertices': 'Вершини',
  'import.triangles': 'Трикутники',
  'import.segments': 'Сегменти',
  'import.recentImports': 'Нещодавні імпорти',
};

const translations: Record<Locale, Record<string, string>> = { en, uk };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'uk') return stored;
  } catch {}
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  const t = useCallback((key: string): string => {
    return translations[locale][key] ?? translations.en[key] ?? key;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}
