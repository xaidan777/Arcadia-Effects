// Arcaidia Effector — локализация UI. Исходные строки — английские (ключи),
// перевод — словарь EN -> RU. AFX.t(key) — хелпер, AFX.setLang перезагружает страницу.
(function () {
'use strict';
const AFX = window.AFX;

let lang = 'en';
try { lang = localStorage.getItem('afx.lang') || 'en'; } catch (e) {}
if (lang !== 'en' && lang !== 'ru') lang = 'en';
AFX.lang = lang;

AFX.setLang = function (l) {
    if (l !== 'en' && l !== 'ru') return;
    try { localStorage.setItem('afx.lang', l); } catch (e) {}
    if (AFX.flushAutosave) AFX.flushAutosave(); // не потерять несохранённую сессию
    location.reload();
};

const RU = {
    // топбар и панели
    'Undo': 'Отменить', 'Redo': 'Повторить', 'Save': 'Сохранить',
    'Global Settings': 'Глобальные настройки',
    'Effects Catalog': 'Каталог эффектов',
    'Textures': 'Текстуры',
    'Inspector': 'Инспектор',
    'Settings': 'Настройки',
    'Language': 'Язык',
    'Help': 'Справка',
    'Version': 'Версия',
    'Close': 'Закрыть',
    'Author': 'Автор',
    'Anton Chuev': 'Антон Чуев',
    'Arcaidia Effector is an editor for authoring 2D effects for game projects. Its architecture is designed to be as efficient as possible for hybrid work with agentic LLM systems.':
        'Arcaidia Effector — редактор для создания 2D-эффектов для игровых проектов. Архитектура разработана таким образом, чтобы быть максимально эффективной при гибридной работе с агентными LLM-системами.',
    'It ships with orchestrators and skills that let an LLM not only author effects, but also change the functionality of the editor itself.':
        'Содержит оркестраторы и скиллы, которые позволяют LLM не только создавать эффекты, но и менять функционал самого редактора.',
    'Failed to open the effect from URL': 'Не удалось открыть эффект по ссылке',

    // общие
    'Preview': 'Превью', 'Atlas': 'Атлас', 'Fit': 'Вписать',
    'Checker': 'Шахматка', 'Dark bg': 'Тёмный фон', 'Black bg': 'Чёрный фон', 'Light bg': 'Светлый фон',
    'particles': 'частиц', 'atlas': 'атлас', 'frames': 'кадров', 'cell': 'ячейка', 'footage fps': 'fps футажа',

    // плеебл-вьюпорт вкладки атласа и маркеры кадров на линейке
    'Playback': 'Плеебл', 'Frame': 'Кадр', 'Atlas end': 'Конец атласа',
    's': 'с', 'f': 'к', 'deg': 'град', 'px/s': 'px/с', 'color': 'цвет',
    'Accept': 'Принять', 'Cancel': 'Отмена',

    // глобальные настройки
    'Composition': 'Композиция', 'Width': 'Ширина', 'Height': 'Высота',
    'Duration': 'Длительность', 'Project FPS': 'FPS проекта',
    'Camera': 'Камера', 'Compression': 'Компрессия',
    'Atlas Export': 'Экспорт атласа', 'Columns': 'Колонки', 'Rows': 'Ряды', 'Frames': 'Кадров',
    'Cell W': 'Ячейка W', 'Cell H': 'Ячейка H',
    'Mode': 'Режим',
    'Color, transparent bg': 'Цвет, прозрачный фон',
    'Color on black': 'Цвет на чёрном',
    'Mask (white on black)': 'Маска (белое на чёрном)',
    'Mask threshold': 'Порог маски',
    'Supersample 2x': 'Сглаживание 2x',
    'Show atlas': 'Показать атлас', 'Download PNG': 'Скачать PNG', 'Meta JSON': 'Мета JSON',
    'Export sequence': 'Экспорт секвенции',
    'Export PNG sequence': 'Экспорт PNG-секвенции',
    'Export': 'Экспорт',
    'Frame W': 'Кадр W', 'Frame H': 'Кадр H', 'FPS': 'FPS',
    'File name': 'Имя файла',
    'one .zip archive': 'одним архивом .zip',
    'too many frames — lower the fps or shorten the range': 'слишком много кадров — уменьшите fps или диапазон',
    'Rendering frames': 'Рендер кадров',
    'Packing the archive': 'Упаковка архива',
    'Sequence saved': 'Секвенция сохранена',
    'Sequence export cancelled': 'Экспорт секвенции отменён',
    'Sequence export failed': 'Не удалось экспортировать секвенцию',

    // каталог
    'New': 'Новый', 'Import': 'Импорт', 'Export': 'Экспорт',
    'Mine': 'Мои', 'Factory': 'Заводские', 'factory preset': 'заводской пресет',
    'Unsaved': 'Несохранённые', 'not saved': 'не сохранён',
    'Remove from session': 'Убрать из сессии',
    'Discard unsaved effect': 'Выбросить несохранённый эффект',
    'Empty. The Save button adds the current effect.': 'Пусто. Кнопка "Сохранить" добавит текущий эффект.',
    'Open': 'Открыть',
    'Reset edits (to factory)': 'Сбросить правки (к заводскому)',
    'Reset edits (to saved)': 'Сбросить правки (к сохранённому)',
    'Delete from catalog': 'Удалить из каталога',
    'Delete effect': 'Удалить эффект',
    'Saved': 'Сохранено', 'Saved to localStorage': 'Сохранено в localStorage',
    'Server save error': 'Ошибка сохранения на сервер',
    'Failed to read the effect.': 'Не удалось прочитать эффект.',
    'Not an Arcaidia Effector file.': 'Файл не похож на эффект Arcaidia Effector.',
    'Failed to parse JSON.': 'Не удалось разобрать JSON.',
    'localStorage is full (likely textures). Use run.bat: the server stores effects as files.':
        'localStorage переполнен (вероятно, из-за текстур). Используй run.bat: сервер хранит эффекты в файлах.',
    'Session does not fit in localStorage: save your effects to the catalog.':
        'Сессия не влезает в localStorage: сохрани эффекты в каталог.',

    // текстуры
    'No textures. Import a PNG or drop a file into the window. Drag a texture from the list into the preview or onto the timeline to create a sprite layer.':
        'Нет текстур. Импортируй PNG или перетащи файл в окно. Текстуру из списка тяни в превью или на таймлайн — создастся спрайт-слой.',
    'Drag a row into the preview or onto the timeline to create a layer.': 'Тяни строку в превью или на таймлайн — создастся слой.',
    'footage': 'футаж', 'no data': 'нет данных',
    'Grid': 'Сетка',
    'cols': 'кол.', 'rows': 'ряд.',
    'Drop to import': 'Отпусти, чтобы импортировать',
    'Add sprite atlas': 'Добавить спрайт-атлас', 'Atlas grid': 'Сетка атласа',
    'Sheet': 'Лист', 'Import sheet...': 'Импорт листа...',
    'Choose sheet...': 'Выбрать лист...',
    'Sprite atlas': 'Спрайт-атлас',
    'Drop a sprite sheet here': 'Перетащи сюда лист со спрайтами',
    'Choose file...': 'Выбрать файл...',
    'or take one from the project:': 'или возьми из проекта:',
    'Load a PNG sheet or pick one from the project — the grid is guessed from the aspect ratio.':
        'Загрузи PNG-лист или возьми из проекта — сетка угадается по соотношению сторон.',
    'No sheet selected — pick a texture or import one.': 'Лист не выбран — возьми текстуру или импортируй новый.',
    'no grid on this texture — press Grid': 'у текстуры нет сетки — нажми «Сетка»',
    'stretched over the layer window': 'растянуто на окно слоя', 'loops': 'циклом',
    'Frame size': 'Размер кадра',
    'Square cells:': 'Квадратные ячейки:',
    'the image is not evenly divisible by this grid': 'картинка не делится нацело на эту сетку',

    // инспектор
    'Select a layer to edit its parameters.': 'Выбери слой, чтобы редактировать параметры.',
    'Layer': 'Слой', 'Blend': 'Смешивание',
    'Normal': 'Обычное', 'Add (lighter)': 'Сложение (add)', 'Screen': 'Экран (screen)', 'Multiply': 'Умножение',
    'Opacity': 'Непрозрачность',
    'Start (s)': 'Начало (с)',
    'Emission end (s)': 'Конец эмиссии (с)', 'End (s)': 'Конец (с)',
    'Emitter': 'Эмиттер', 'Shape': 'Форма',
    'Point': 'Точка', 'Circle / Ellipse': 'Круг / эллипс', 'Box': 'Прямоугольник', 'Line': 'Линия',
    'Position X': 'Позиция X', 'Position Y': 'Позиция Y',
    'Size X': 'Размер X', 'Size Y': 'Размер Y',
    'Direction': 'Направление',
    'Outward': 'Наружу', 'Inward': 'Внутрь', 'Omni': 'Во все стороны', 'By angle': 'По углу',
    'Angle': 'Угол', 'Angle spread': 'Разброс угла',
    'Speed': 'Скорость', 'Speed random': 'Случайность скор.',
    'Rate (per sec)': 'Поток (частиц/с)',
    'Seed': 'Сид',
    'Smooth emission': 'Плавная эмиссия',
    'Particle': 'Частица', 'Sprite': 'Спрайт',
    'Life (s)': 'Жизнь (с)', 'Life random': 'Случайность жизни',
    'Size': 'Размер', 'Size random': 'Случайность разм.',
    'Size over life': 'Размер за жизнь',
    'Size over trail': 'Размер вдоль трейла',
    'Opacity over life': 'Прозрачность за жизнь',
    'Color over life': 'Цвет за жизнь',
    'Tint texture': 'Тонировать текстуру',
    'Footage FPS': 'FPS футажа',
    'Rotation & Shape': 'Вращение и форма',
    'Rotation': 'Поворот', 'Random rotation': 'Случайный поворот',
    'Spin (deg/s)': 'Вращение (град/с)', 'Spin random': 'Случайность вращ.',
    'Align to velocity': 'По вектору скорости',
    'Stretch': 'Растяжение',
    'Physics': 'Физика',
    'Gravity X': 'Гравитация X', 'Gravity Y': 'Гравитация Y',
    'Drag': 'Сопротивление', 'Turbulence': 'Турбулентность', 'Turb. frequency': 'Частота турб.',
    'Turbulence type': 'Тип турбулентности',
    'Noise (per particle)': 'Шум (на частицу)',
    'Curl field (vortices)': 'Curl-поле (вихри)',
    'Vortex size': 'Размер вихря',
    'Turb. octaves': 'Октавы турб.',
    'Field rise (px/s)': 'Всплытие поля (px/с)',
    'Wind (px/s)': 'Ветер (px/с)',
    'Field seed': 'Сид поля',
    'Laminar base': 'Ламинарное основание',
    // постэффект искажения
    'Post effect': 'Постэффект', 'Effect': 'Эффект',
    'Turbulent displace': 'Турбулентное искажение',
    'Amount': 'Величина',
    'Displace amount': 'Величина искажения',
    'Field': 'Поле',
    'Swirl (no holes)': 'Вихревое (без дыр)', 'Tear (sharper rips)': 'Рвущее (резче разрывы)',
    'Fold size': 'Размер складки',
    'Fold stretch': 'Вытянутость складки',
    'Detail octaves': 'Октавы детализации',
    'Evolution (Hz)': 'Перерождение (Гц)',
    'Calm base': 'Спокойное основание',
    'Calm amount': 'Сила успокоения',
    'Calm line Y': 'Линия успокоения Y',
    'Calm falloff': 'Спад успокоения',
    'Appearance': 'Вид',
    'Sprite squash': 'Сжатие спрайта',
    'Glow': 'Свечение',
    'Glow size': 'Размер свечения', 'Glow softness': 'Мягкость свечения',
    'Radial fade': 'Радиальное затухание',
    'Fade X': 'Затухание: X', 'Fade Y': 'Затухание: Y', 'Fade radius': 'Затухание: радиус',
    'Softness': 'Мягкость',
    'Gizmos': 'Гизмо',
    'Forces': 'Силы',
    'gravity': 'гравитация', 'curl': 'curl', 'wind': 'ветер', 'path': 'путь', 'peak': 'пик',
    'no field forces': 'пространственных сил нет',
    'noise turbulence is per-particle': 'шумовая турбулентность — своя у каждой частицы',
    'Layer glow': 'Свечение слоя',

    // постэффекты (слой Post FX)
    'Post FX': 'Пост-эффект',
    'Effect strength': 'Сила эффекта',
    'Motion blur': 'Смаз движения',
    'Directional': 'По направлению',
    'Radial (zoom / spin)': 'Радиальный (зум / вращение)',
    'Length': 'Длина',
    'Spin': 'Вращение',
    'Center X': 'Центр X', 'Center Y': 'Центр Y',
    'Blur length': 'Длина смаза', 'Blur angle': 'Угол смаза',
    'Quality': 'Качество',
    'Samples': 'Сэмплы',
    'Half resolution': 'Половинное разрешение',
    // постэффект «пиксель-арт»
    'Pixel art': 'Пиксель-арт',
    'Pixel grid': 'Сетка пикселей',
    'Art resolution': 'Разрешение арта',
    'cells': 'ячеек', 'cell': 'ячейка', 'per cell': 'на ячейку',
    'uneven blocks': 'блоки неровные',
    'Square blocks': 'Ровные квадраты',
    'Pixel aspect': 'Пропорция пикселя',
    'Grid offset X': 'Сдвиг сетки X', 'Grid offset Y': 'Сдвиг сетки Y',
    'Sampling': 'Выборка', 'Sample': 'Выборка',
    'Average (area)': 'Среднее (по площади)', 'Point (nearest)': 'Точка (ближайший)',
    'Peak (keep detail)': 'Пик (беречь детали)',
    'Alpha gain': 'Усиление альфы',
    'Alpha': 'Альфа', 'Cut (1-bit)': 'Порог (1 бит)', 'Steps': 'Ступени', 'Soft (keep)': 'Мягкая (как есть)',
    'Alpha cutoff': 'Порог альфы',
    'Alpha steps': 'Ступеней альфы',
    'Color quantize': 'Квантование цвета',
    'Saturation': 'Насыщенность', 'Contrast': 'Контраст',
    'Quantize': 'Квантование', 'None': 'Нет',
    'Levels (posterize)': 'Уровни (постеризация)', 'Palette': 'Палитра', 'Ramp by brightness': 'Рампа по яркости',
    'Levels per channel': 'Уровней на канал',
    'Mono (1-bit)': 'Моно (1 бит)', 'Game Boy (4)': 'Game Boy (4)', 'CGA (16)': 'CGA (16)',
    'PICO-8 (16)': 'PICO-8 (16)', 'Sweetie (16)': 'Sweetie (16)', 'NES (54)': 'NES (54)',
    'Ember ramp (12)': 'Угли, рампа (12)', 'Ice ramp (12)': 'Лёд, рампа (12)',
    'Brightness ramp': 'Рампа яркости', 'Ramp steps': 'Ступеней рампы',
    'Dither': 'Дизеринг', 'Dither amount': 'Сила дизеринга',
    'Outline': 'Обводка', 'Outline side': 'Сторона обводки', 'Outline color': 'Цвет обводки',
    'Outside silhouette': 'Снаружи силуэта', 'Inside edge': 'По кромке внутри',
    'Pixel art 1:1': 'Пиксель-арт 1:1',
    'from the Pixel art layer': 'из слоя пиксель-арта',
    'no Pixel art layer in the stack — falling back to Cell W/H':
        'слоя пиксель-арта в стеке нет — берётся Cell W/H',
    'Atlas exports 1:1 at': 'Атлас экспортируется 1:1 в',
    'Atlas uses the topmost pixel-art layer, not this one': 'Атлас берёт самый верхний слой пиксель-арта, не этот',
    'Turn on Pixel art 1:1 in Atlas Export to ship this resolution':
        'Включите «Пиксель-арт 1:1» в экспорте атласа, чтобы отдать это разрешение',
    'Pixel Art (adjustment)': 'Пиксель-арт (корректор)',

    'Glow radius (px)': 'Радиус свечения (px)',
    'Render': 'Рендер', 'Trail (path line)': 'Трейл (линия пути)',
    'Trail core': 'Белое ядро трейла',
    'Zigzag (deg/s)': 'Зигзаг (град/с)',
    'Branching': 'Ветвление',
    'Branch chance (per sec)': 'Шанс ветки (в сек)',
    'Branch spread': 'Разброс ветки',
    'Branch life scale': 'Жизнь ветки, доля',
    'Branch size scale': 'Толщина ветки, доля',
    'Branch speed scale': 'Скорость ветки, доля',
    'Max generations': 'Макс. поколений',
    'Lightning': 'Молния',

    // суб-эмиттер
    'Sub-emitter': 'Суб-эмиттер',
    'Enable sub-emitter': 'Включить суб-эмиттер',
    'Emit': 'Эмиссия',
    'At parent death': 'При гибели родителя',
    'Along parent life': 'По ходу жизни родителя',
    'Both': 'И то, и другое',
    'Sub rate (per sec)': 'Суб-темп (в сек)',
    'Start at (life)': 'Начинать с (доля жизни)',
    'Count at death': 'Выброс при гибели',
    'Sub direction': 'Суб-направление',
    'Along parent velocity': 'Вдоль скорости родителя',
    'Opposite parent velocity': 'Против скорости родителя',
    'Away from emitter': 'От центра эмиттера',
    'Sub spread': 'Суб-разброс',
    'Sub speed': 'Суб-скорость',
    'Sub speed random': 'Разброс суб-скорости',
    'Inherit velocity': 'Наследование скорости',
    'Generation scale': 'Масштаб поколения',
    'Sub budget': 'Суб-бюджет',
    'Draw under parents': 'Рисовать под родителями',
    'Sub particle': 'Суб-частица',
    'Sub rotation & shape': 'Суб-вращение и форма',
    'Sub physics': 'Суб-физика',
    'Sub appearance': 'Суб-вид',
    'Sub rate': 'Суб-темп',
    'Sub particle size': 'Размер суб-частицы',
    'Sub gravity X': 'Суб-гравитация X', 'Sub gravity Y': 'Суб-гравитация Y',
    'Sub turbulence': 'Суб-турбулентность',
    'Firework (sub-emitter)': 'Фейерверк (суб-эмиттер)',

    'Source': 'Источник', 'Base size': 'Базовый размер',
    'Transform': 'Трансформ', 'Scale': 'Масштаб', 'Aspect X/Y': 'Пропорция X/Y',
    'Color & Look': 'Цвет и вид', 'Color': 'Цвет',

    // виджеты
    'Key at current time': 'Ключ в текущем времени',
    'Curve preset...': 'Пресет кривой...',
    'Gradient preset...': 'Пресет градиента...',
    'Shapes': 'Фигуры',
    'No textures yet. Import them in the Textures panel.': 'Нет текстур. Импорт — в панели "Текстуры".',
    'Random': 'Случайный', 'Variant': 'Вариант',
    'Emission bursts: time (s) / count': 'Вспышки эмиссии: время (с) / частиц',
    'Burst': 'Вспышка',
    'Value:': 'Значение:',

    // фигуры и параметры
    'Soft Circle': 'Мягкий круг', 'Circle': 'Круг', 'Ring': 'Кольцо', 'Square': 'Квадрат',
    'Polygon': 'Полигон', 'Star': 'Звезда', 'Streak': 'Штрих', 'Spark': 'Искра',
    'Smoke Puff': 'Клуб дыма', 'Cartoon Puff': 'Мульт-клуб', 'Shard': 'Осколок',
    'Flame Tongue': 'Язык пламени', 'Ember': 'Уголёк',
    'Thickness': 'Толщина', 'Sides': 'Стороны', 'Points': 'Лучи', 'Inner radius': 'Внутр. радиус',
    'Taper': 'Заострение',
    'texture?': 'текстура?',

    // пресеты кривых и градиентов
    'Constant 1': 'Константа 1', 'Fade Out': 'Затухание', 'Fade In': 'Появление',
    'Flash Pulse': 'Вспышка-импульс', 'Bell': 'Колокол', 'Grow': 'Рост', 'Fast Grow': 'Быстрый рост',
    'Shrink': 'Сжатие', 'Pop & Decay': 'Хлопок и спад',
    'Fire': 'Огонь', 'Plasma': 'Плазма', 'Smoke': 'Дым', 'Light Smoke': 'Дым светлый',
    'Sparks': 'Искры', 'Ice': 'Лёд', 'Energy': 'Энергия', 'Poison': 'Яд', 'White': 'Белый', 'Gold': 'Золото',

    // пресеты слоёв (лейблы меню)
    'Flash': 'Вспышка', 'Shockwave': 'Ударная волна', 'Fireball': 'Огненный шар',
    'Debris': 'Обломки', 'Particle Ring': 'Кольцо частиц', 'Flame (stream)': 'Пламя (поток)',
    'Snow / Ash': 'Снег / пепел',

    // таймлайн
    'Presets': 'Пресеты',
    'Layers': 'Слои', 'Graph': 'График',
    'No layers. Add buttons are at the top of the timeline.': 'Слоёв нет. Кнопки добавления — сверху на таймлайне.',

    // шпаргалка по хоткеям на таймлайне (клавиша + действие)
    'Space': 'Пробел', 'Del': 'Del',
    'Shift+click': 'Shift+клик', 'Shift+drag': 'Shift+драг',
    'RMB key': 'ПКМ по ключу', 'Ctrl+wheel': 'Ctrl+колесо',
    'MMB drag': 'СКМ драг', 'MMB click': 'СКМ клик', 'Dbl-click': 'Дабл-клик',
    'play': 'плей', 'parameters': 'параметры', 'delete': 'удалить',
    'multi-select': 'мультивыбор', 'easing': 'изинг', 'zoom': 'зум',
    'pan': 'пан', 'reset view': 'сброс вида', 'no snap': 'без снэпа',
    'add / remove point': 'добавить / удалить точку',
    'Rename': 'Переименовать', 'Duplicate': 'Дублировать',
    'Move up': 'Выше', 'Move down': 'Ниже', 'Delete': 'Удалить',
    'Linear': 'Линейный', 'Easy Ease': 'Плавный (Easy Ease)', 'Easy In': 'Плавный вход (Easy In)',
    'Easy Out': 'Плавный выход (Easy Out)', 'Hold / Flat': 'Ступенька (Hold / Flat)',
    'Delete key(s)': 'Удалить ключ(и)',
    'Over particle life': 'За жизнь частицы',
    'No animated properties. Enable a stopwatch on a parameter.': 'Нет анимированных свойств. Включи секундомер у параметра.',
    'Select a layer.': 'Выбери слой.',
    'Select a property or a curve on the left.': 'Выбери свойство или кривую слева.',
    '(X axis — particle life 0..1, drag points, double-click to add/remove)':
        '(ось X — жизнь частицы 0..1, драг точек, дабл-клик — добавить/удалить)',
    'Emitter X': 'Эмиттер X', 'Emitter Y': 'Эмиттер Y',
    'Spread': 'Разброс', 'Rate': 'Поток', 'Particle size': 'Размер частиц',

    // путь движения (motion path)
    'Motion Path': 'Путь движения',
    'Enable path': 'Включить путь',
    'Path mode': 'Режим пути',
    'Emit along path': 'Эмиссия вдоль пути',
    'Guide particles': 'Ведение частиц',
    'Emit and guide': 'Эмиссия и ведение',
    'Smooth curve': 'Сглаженная кривая',
    'Closed path': 'Замкнутый путь',
    'Nodes — offsets from the emitter position': 'Узлы — смещения от позиции эмиттера',
    'Node': 'Узел',
    'Delete node': 'Удалить узел',
    'Spawn along': 'Раскладка рождения',
    'Even': 'Равномерно',
    'At path start': 'В начале пути',
    'Spawn jitter': 'Разброс рождения',
    'Emit direction': 'Направление вылета',
    'Use emitter direction': 'Направление эмиттера',
    'Along the path': 'Вдоль пути',
    'Across the path': 'Поперёк пути',
    'Attract': 'Притяжение',
    'Lock to path': 'Прилипание к пути',
    'Flow speed': 'Скорость потока',
    'Fast search': 'Быстрый поиск',
    'Path jitter': 'Разброс пути', 'Path attract': 'Притяжение пути',
    'Path lock': 'Прилипание к пути', 'Path flow': 'Поток пути',
    'Path node': 'Узел пути',
    'Insert node here': 'Вставить узел здесь',
    'Animate node': 'Анимировать узел',
    'Remove node animation': 'Убрать анимацию узла',
    'animated': 'анимирован',
    'Reverse direction': 'Развернуть путь',
    'Disable path': 'Выключить путь',
    'Blade (path)': 'Клинок (путь)',
    'Path Flow (S-curve)': 'Поток по пути (S-кривая)',

    // адресация слоёв-корректоров (postfx / силовое поле)
    'Affected layers': 'На какие слои действует',
    'All layers below': 'Все слои ниже',
    'Nothing below to affect': 'Ниже нет слоёв, на которые можно действовать',
    'Selected layers': 'Выбрано слоёв',
    'out of reach': 'вне досягаемости',
    'Move the layer above the ones it should affect': 'Поднимите слой выше тех, на которые он должен действовать',
    'Affect all below': 'Действовать на всё ниже',
    'Group blend': 'Блендинг группы',

    // слой СИЛОВОГО ПОЛЯ (force)
    'Force': 'Силовое поле',
    'Force field': 'Силовое поле',
    'Master strength': 'Общая сила',
    'No fields — the layer does nothing.': 'Полей нет — слой ничего не делает.',
    'Delete field': 'Удалить поле',
    'Enabled': 'Включено',
    'Type': 'Вид',
    'Collapse': 'Сжатие', 'Expand': 'Расширение', 'Drive': 'Закрутка',
    'Collapse (pull in)': 'Collapse — стягивает к центру',
    'Expand (push out)': 'Expand — расталкивает от центра',
    'Drive (orbit)': 'Drive — гонит по кругу',
    'Strength': 'Сила',
    'Falloff': 'Спад',
    'Scale X': 'Размер X', 'Scale Y': 'Размер Y',
    'px/s²': 'px/с²',
    'force fields': 'силовые поля',
    'no active fields in this layer': 'в слое нет активных полей',
    'select an emitter or a force field layer': 'выберите слой-эмиттер или силовое поле',

    // статусы
    'Copied layers': 'Скопировано слоёв',
    'Pasted layers': 'Вставлено слоёв',
    'Meta copied to clipboard': 'Мета скопирована в буфер'
};

// ПОДСКАЗКИ ПРИ НАВЕДЕНИИ (атрибут data-tip, см. D.tip в dom.js): что делает настройка
// или кнопка. Каждая строка — от 30 до 120 символов И по-английски, И по-русски;
// проверка — node tools/i18ncheck.mjs. Ключ лежит либо здесь, либо в RU, не в обоих.
const TIPS = {
    // топбар, настройки, справка
    'Undo the last change to the effect (Ctrl+Z)': 'Отменить последнюю правку эффекта (Ctrl+Z)',
    'Redo the change you just undid (Ctrl+Y or Ctrl+Shift+Z)':
        'Вернуть только что отменённую правку (Ctrl+Y или Ctrl+Shift+Z)',
    'Save the effect to the catalog: a file in library/ with the server, otherwise localStorage (Ctrl+S)':
        'Сохранить эффект в каталог: файл в library/ при запущенном сервере, иначе localStorage (Ctrl+S)',
    'The effect has unsaved changes — save it to the catalog (Ctrl+S)':
        'У эффекта есть несохранённые правки — сохраните его в каталог (Ctrl+S)',
    'Download the sprite atlas as a PNG built with the Atlas Export settings':
        'Скачать спрайт-атлас в PNG, собранный по настройкам экспорта атласа',
    'Save the effect as a numbered PNG sequence (.zip)': 'Сохранить эффект нумерованной PNG-секвенцией (.zip)',
    'Effect name — shown in the catalog and used for saved and exported file names':
        'Имя эффекта — видно в каталоге и идёт в имена сохранённых и экспортных файлов',
    'Editor settings: interface language (switching it reloads the page)':
        'Настройки редактора: язык интерфейса (смена перезагружает страницу)',
    'About Arcaidia Effector: version, author and contacts': 'О программе Arcaidia Effector: версия, автор и контакты',
    'Close the help window and return to the editor': 'Закрыть окно справки и вернуться в редактор',
    'Interface language; the page reloads and unsaved edits stay in the session':
        'Язык интерфейса; страница перезагрузится, несохранённые правки останутся в сессии',

    // каталог
    'New empty effect (current edits stay in the session)': 'Новый пустой эффект (текущие правки останутся в сессии)',
    'Open an effect from a .json file (you can also drop the file into the window)':
        'Открыть эффект из .json-файла (файл можно и просто бросить в окно)',
    'Download the current effect as a .json file with its textures embedded':
        'Скачать текущий эффект .json-файлом вместе со встроенными текстурами',
    'Unsaved draft that lives only in the session: Save puts it into the catalog':
        'Несохранённый черновик, живёт только в сессии: «Сохранить» добавит его в каталог',
    'Discard this unsaved draft from the session — its edits are lost':
        'Выбросить несохранённый черновик из сессии — его правки пропадут',
    'Unsaved edits (kept in the session)': 'Есть несохранённые правки (живут в сессии)',
    'Factory preset: click to open a working copy, right-click to reset your edits':
        'Заводской пресет: клик открывает рабочую копию, ПКМ — сбросить ваши правки',
    'Saved effect: click to open it, right-click to reset your edits or delete it':
        'Сохранённый эффект: клик — открыть, ПКМ — сбросить правки или удалить',
    'Delete this saved effect from the catalog; with the server its file is removed too':
        'Удалить сохранённый эффект из каталога; при сервере удаляется и его файл',

    // глобальные настройки: композиция, камера, экспорт атласа
    'Composition width in pixels — the canvas the effect is rendered on':
        'Ширина композиции в пикселях — холст, на котором рисуется эффект',
    'Composition height in pixels; exports fit the composition into a frame keeping its aspect':
        'Высота композиции в пикселях; при экспорте она вписывается в кадр с сохранением пропорций',
    'Length of the composition in seconds — the range of the timeline and playback':
        'Длина композиции в секундах — диапазон таймлайна и проигрывания',
    'Frame rate for key snapping, frame stepping and the default fps of the sequence export':
        'Частота кадров: снэп ключей, шаг по кадрам и fps экспорта секвенции по умолчанию',
    'Camera tilt to the effect plane. 0 — side view, 37 — game isometry (scaleY 0.8).':
        'Наклон камеры к плоскости эффекта. 0 — вид сбоку, 37 — изометрия игры (scaleY 0.8).',
    'Vertical scale this camera compression gives to the effect plane':
        'Вертикальный масштаб, который эта компрессия камеры даёт плоскости эффекта',
    'Columns in the atlas grid; changing it resets Frames to columns × rows':
        'Колонки сетки атласа; при смене «Кадров» становится колонки × ряды',
    'Rows in the atlas grid; changing it resets Frames to columns × rows':
        'Ряды сетки атласа; при смене «Кадров» становится колонки × ряды',
    'How many frames to sample between Start and End, one per cell; at most columns × rows':
        'Сколько кадров снять между Началом и Концом, по кадру на ячейку; не больше колонки × ряды',
    'Export 1:1 at the grid of the Pixel art layer: no supersampling, nearest filtering, no Cell W/H':
        'Экспорт 1:1 по сетке слоя пиксель-арта: без суперсэмпла, фильтр nearest, без «Ячейка W/H»',
    'Width of one atlas cell in pixels; the composition is fitted inside keeping its aspect':
        'Ширина ячейки атласа в пикселях; композиция вписывается в неё с сохранением пропорций',
    'Height of one atlas cell in pixels; the sheet is columns × Cell W by rows × Cell H':
        'Высота ячейки атласа в пикселях; лист выходит колонки × ширина на ряды × высота',
    'First atlas frame boundary — the same blue marker on the timeline ruler':
        'Первая граница кадров атласа — тот же голубой маркер на линейке таймлайна',
    'Last atlas frame boundary — the hollow marker on the ruler; -1 — the end of the composition':
        'Последняя граница кадров атласа — полый маркер на линейке; -1 — конец композиции',
    'Atlas pixels: color with alpha, color on a black background, or a white-on-black alpha mask':
        'Пиксели атласа: цвет с альфой, цвет на чёрном фоне или маска альфы белым на чёрном',
    '0 — soft mask, higher — hard binarization': '0 — мягкая маска, выше — жёсткая бинаризация',
    'Render at double size and scale down — smoother edges, slower export':
        'Рендер в двойном размере с уменьшением — кромки глаже, экспорт медленнее',
    'Open the Atlas tab: the assembled sheet and its frame playback on the side':
        'Открыть вкладку «Атлас»: собранный лист и проигрывание его кадров сбоку',
    'Copy the atlas description (grid, cell size, frames, fps) to the clipboard as JSON':
        'Скопировать описание атласа (сетка, размер ячейки, кадры, fps) в буфер обмена как JSON',

    // диалог экспорта PNG-секвенции
    'Width of every exported PNG frame; the composition is fitted inside':
        'Ширина каждого экспортного PNG-кадра; композиция вписывается в него',
    'Height of every exported PNG frame; the composition is fitted inside':
        'Высота каждого экспортного PNG-кадра; композиция вписывается в него',
    'Frames per second of the sequence: frame count = (End − Start) × FPS':
        'Кадров в секунду у секвенции: число кадров = (Конец − Начало) × FPS',
    'The moment the sequence starts from, in seconds': 'С какого момента начинается секвенция, в секундах',
    'The moment the sequence ends at, in seconds (up to the composition length)':
        'На каком моменте секвенция заканчивается, в секундах (не дальше длины композиции)',
    'Frame pixels: color with alpha, color on black, or a white-on-black alpha mask':
        'Пиксели кадров: цвет с альфой, цвет на чёрном или маска альфы белым на чёрном',
    'Frame = the Pixel art layer grid, nearest interpolation': 'Кадр = сетка слоя пиксель-арта, интерполяция nearest',
    'Name of the archive and the prefix of every frame file inside it':
        'Имя архива и префикс каждого файла кадра внутри него',
    'Render every frame and download them as one .zip archive with meta.json':
        'Отрендерить все кадры и скачать одним .zip-архивом вместе с meta.json',
    'Close the dialog; during an export this stops the rendering':
        'Закрыть диалог; во время экспорта — остановить рендер',

    // текстуры, диалоги листа и сетки атласа
    'Import images (or drop files into the window)': 'Импорт картинок (или перетащите файлы в окно)',
    'Add a sprite atlas: the grid is guessed from the aspect ratio and confirmed in a dialog':
        'Добавить спрайт-атлас: сетка угадывается по соотношению сторон и подтверждается в диалоге',
    'Drag into the preview or onto the timeline to create a layer with this texture':
        'Перетащите в превью или на таймлайн — создастся слой с этой текстурой',
    'Footage atlas: set the grid and fps of this sheet; click again to clear the mark':
        'Футаж-атлас: задать сетку и fps листа; повторный клик снимает пометку',
    'Remove the texture from the effect; layers that use it will draw nothing':
        'Удалить текстуру из эффекта; слои, которые её используют, станут пустыми',
    'Columns of frames in the footage grid; drag or double-click to type':
        'Колонки кадров в сетке футажа; тяните или дважды кликните для ввода',
    'Rows of frames in the footage grid; drag or double-click to type':
        'Ряды кадров в сетке футажа; тяните или дважды кликните для ввода',
    'Native frame rate of the sheet: a new atlas layer lasts frames ÷ fps seconds':
        'Родной fps листа: новый слой-атлас длится кадры ÷ fps секунд',
    'A grid of square cells that divides the sheet without a remainder':
        'Сетка с квадратными ячейками, которая делит лист без остатка',
    'How many columns of frames the sheet holds': 'Сколько колонок кадров помещается в листе',
    'How many rows of frames the sheet holds': 'Сколько рядов кадров помещается в листе',
    'Apply this grid: frames are cut from the sheet by columns and rows':
        'Применить сетку: кадры нарезаются из листа по колонкам и рядам',
    'Close the dialog without changing anything': 'Закрыть диалог, ничего не меняя',
    'Pick a sprite sheet image on disk; you can also drop it onto this box':
        'Выбрать картинку-лист на диске; её можно и бросить в эту рамку',
    'Use this project texture as the sheet and set its grid below':
        'Взять эту текстуру проекта как лист и настроить её сетку ниже',
    'Use the chosen sheet with this grid': 'Использовать выбранный лист с этой сеткой',

    // инспектор: слой
    'How the layer mixes with the layers below: Add and Screen brighten, Multiply darkens':
        'Как слой смешивается с нижними: Add и Screen высветляют, Multiply затемняет',
    'Layer opacity multiplier; animate it to fade the whole layer in or out':
        'Множитель непрозрачности слоя; анимируйте, чтобы плавно проявить или погасить слой',
    'Mix of the processed frame with the clean one (0 — bypass)':
        'Подмешивание обработанного кадра к чистому (0 — байпас)',
    'Common multiplier for every field of this layer (0 — bypass). Animate it to fade the forces in':
        'Общий множитель для всех полей слоя (0 — байпас). Анимируйте его, чтобы вводить силы плавно',
    'When the layer window opens, in seconds; moving it keeps the window length':
        'Когда открывается окно слоя, в секундах; сдвиг сохраняет длину окна',
    'When the layer window closes, in seconds — the end of the bar on the timeline':
        'Когда закрывается окно слоя, в секундах — конец бара на таймлайне',
    'Can be negative: the simulation starts before composition zero':
        'Может быть отрицательным: симуляция стартует до нуля композиции',
    'When the emitter stops spawning; live particles still finish their life':
        'Когда эмиттер перестаёт рождать частицы; живые частицы доживают свой срок',
    'Post-process: blurred additive glow of the whole layer (best for trails)':
        'Постобработка: блюр-свечение всего слоя аддитивно (лучше всего для трейлов)',
    'Blur radius of the layer glow in pixels — larger means a wider, softer halo':
        'Радиус размытия свечения слоя в пикселях — больше значит шире и мягче ореол',
    'Fade the whole layer by distance from a movable center (drag the orange gizmo in the preview)':
        'Затухание всего слоя по расстоянию от подвижного центра (тяните оранжевое гизмо в превью)',
    'Horizontal position of the fade center, px from the composition center':
        'Центр затухания по горизонтали, px от центра композиции',
    'Vertical position of the fade center, px from the composition center':
        'Центр затухания по вертикали, px от центра композиции',
    'Distance from the center at which the layer fades out completely':
        'Расстояние от центра, на котором слой полностью исчезает',
    'Soft edge as a fraction of the radius (0 — hard cut)': 'Мягкая кромка как доля радиуса (0 — жёсткий срез)',

    // инспектор: эмиттер, вспышки, ветвление
    'Where particles are born: a point, inside an ellipse, on a ring, inside a box or along a line':
        'Где рождаются частицы: в точке, внутри эллипса, на кольце, в прямоугольнике или на линии',
    'Horizontal position, px from the composition center (positive is right)':
        'Позиция по горизонтали, px от центра композиции (плюс — вправо)',
    'Vertical position, px from the composition center (positive is down)':
        'Позиция по вертикали, px от центра композиции (плюс — вниз)',
    'Shape radius or half-width; for a ring — its radius, for a line — half its length':
        'Радиус или полуширина формы; у кольца — радиус, у линии — половина длины',
    'Shape half-height; for a ring — the thickness of its band': 'Полувысота формы; у кольца — толщина его полосы',
    'Launch direction: away from the center, toward it, any way, or by Angle within the spread':
        'Направление вылета: от центра, к центру, во все стороны или по Углу в пределах разброса',
    'Launch angle for the By angle direction, also tilts the Line shape: 0 — right, 90 — down':
        'Угол вылета для «По углу», он же наклоняет форму «Линия»: 0 — вправо, 90 — вниз',
    'Width of the random cone around the launch angle, in degrees (360 — full circle)':
        'Ширина случайного конуса вокруг угла вылета, в градусах (360 — полный круг)',
    'Launch speed of new particles in pixels per second': 'Начальная скорость новых частиц в пикселях в секунду',
    'Random speed spread per particle: 0.5 gives from 50% to 150% of Speed':
        'Случайный разброс скорости на частицу: 0.5 даёт от 50% до 150% Скорости',
    'Particles born per second while the emission window is open':
        'Сколько частиц рождается в секунду, пока открыто окно эмиссии',
    'Spawn each particle at its exact moment inside a step — removes rows behind fast emitters':
        'Рождать частицу в её точный момент внутри шага — убирает ряды за быстрым эмиттером',
    'Random seed: another value gives a new particle layout with the same settings':
        'Сид случайности: другое значение даёт новую раскладку частиц при тех же настройках',
    'One-shot bursts: at the given second the emitter releases that many particles at once':
        'Разовые вспышки: в указанную секунду эмиттер выпускает указанное число частиц разом',
    'Burst time in seconds from the layer start; drag or double-click to type':
        'Время вспышки в секундах от начала слоя; тяните или дважды кликните для ввода',
    'How many particles this burst releases; drag or double-click to type':
        'Сколько частиц выпускает вспышка; тяните или дважды кликните для ввода',
    'Remove this burst from the emitter': 'Удалить эту вспышку из эмиттера',
    'Add a burst of 10 particles 0.1 s after the last one': 'Добавить вспышку на 10 частиц через 0.1 с после последней',
    'Each particle may spawn a branch from its position': 'Частица может породить ответвление из своей позиции',
    'Largest angle between a branch and the direction of its parent, in degrees':
        'Наибольший угол между веткой и направлением родителя, в градусах',
    'Branch lifetime as a fraction of the remaining life of its parent':
        'Жизнь ветки как доля оставшейся жизни её родителя',
    'Branch size as a fraction of the size of its parent': 'Размер ветки как доля размера её родителя',
    'Branch speed as a fraction of the speed of its parent': 'Скорость ветки как доля скорости её родителя',
    'How deep branches can branch further': 'Насколько глубоко ветки могут ветвиться дальше',

    // инспектор: путь движения
    'Animated path: particles are born along it and/or follow it (drag the nodes in the preview)':
        'Анимируемый путь: частицы рождаются вдоль него и/или следуют по нему (узлы двигаются в превью)',
    'Emit — the emitter shape is replaced by the path; Guide — particles are pulled along it':
        'Эмиссия — путь заменяет форму эмиттера; Ведение — путь тянет частицы за собой',
    'Catmull-Rom curve through the nodes (from 3 nodes) — off gives a straight polyline':
        'Кривая Catmull-Rom через узлы (от 3 узлов); выкл — прямая ломаная',
    'Connect the last node back to the first one, closing the path into a loop':
        'Соединить последний узел с первым, замкнув путь в петлю',
    'Path nodes: offsets from the emitter position; X and Y of each can be animated':
        'Узлы пути: смещения от позиции эмиттера; X и Y каждого узла можно анимировать',
    'Delete this node (a path always keeps at least two)': 'Удалить этот узел (у пути всегда остаётся минимум два)',
    'Node offset from the emitter position along X, px; you can also drag the node in the preview':
        'Смещение узла от позиции эмиттера по X, px; узел можно и тянуть в превью',
    'Node offset from the emitter position along Y, px; you can also drag the node in the preview':
        'Смещение узла от позиции эмиттера по Y, px; узел можно и тянуть в превью',
    'Add a node after the last one, continuing the direction of the path':
        'Добавить узел за последним, продолжая направление пути',
    'How births spread along the path: at random, evenly spaced, or all at its start':
        'Как рождение раскладывается по пути: случайно, равномерно или всё в его начале',
    'Scatter of the birth point across the path': 'Разброс точки рождения поперёк пути',
    'Where the path aims new particles; the emitter Direction is used when this is off':
        'Куда путь направляет новые частицы; выкл — работает Направление эмиттера',
    'Spring pulling particles to the nearest point of the path (damped by Drag)':
        'Пружина к ближайшей точке пути (гасится Сопротивлением)',
    'Hard follow: 1 — particles stick to the path and move only along it':
        'Жёсткое следование: 1 — частица приклеена к пути и движется только вдоль него',
    'Speed along the path tangent (negative — backwards)': 'Скорость вдоль касательной пути (минус — назад)',
    'Look for the nearest path point near the last one: about 3x faster; turn off if the path crosses itself':
        'Искать ближайшую точку пути возле прошлой: примерно втрое быстрее; выключите, если путь сам себя пересекает',

    // инспектор: частица, вращение, физика, вид
    'Draw each particle as a sprite, or as a trail line along the path it has travelled':
        'Рисовать частицу спрайтом или линией-трейлом вдоль пройденного ею пути',
    'White core line on top of the trail (lightning)': 'Белая линия-ядро поверх трейла (молния)',
    'Particle image: a procedural shape or an imported texture — click to choose':
        'Картинка частицы: процедурная фигура или импортированная текстура — клик для выбора',
    'How long each particle lives, in seconds': 'Сколько живёт каждая частица, в секундах',
    'Random lifetime spread per particle: 0.5 gives from 50% to 150% of Life':
        'Случайный разброс жизни на частицу: 0.5 даёт от 50% до 150% Жизни',
    'Particle size at birth in pixels; the Size over life curve scales it':
        'Размер частицы при рождении в пикселях; кривая «Размер за жизнь» масштабирует его',
    'Random size spread per particle: 0.5 gives from 50% to 150% of Size':
        'Случайный разброс размера на частицу: 0.5 даёт от 50% до 150% Размера',
    'Size multiplier over the particle life: the left edge is birth, the right edge is death':
        'Множитель размера за жизнь частицы: левый край — рождение, правый — гибель',
    'Width along the trail: 0 — start (base), 1 — tip': 'Ширина вдоль трейла: 0 — начало (основание), 1 — кончик',
    'Opacity over the particle life: the left edge is birth, the right edge is death':
        'Непрозрачность за жизнь частицы: левый край — рождение, правый — гибель',
    'Particle color over its life: the left end at birth, the right end at death':
        'Цвет частицы за жизнь: левый край — при рождении, правый — при гибели',
    'Color the texture by Color over life instead of its own colors (not for footage sheets)':
        'Красить текстуру по «Цвет за жизнь» вместо её собственных цветов (кроме листов-футажей)',
    'Frame rate of a footage texture per particle; 0 stretches all frames over its life':
        'Частота кадров футажа у частицы; 0 — растянуть все кадры на её жизнь',
    'Starting rotation of each particle, in degrees': 'Начальный поворот каждой частицы, в градусах',
    'Random start rotation: 1 — any angle, 0.5 — within ±90° of Rotation':
        'Случайный стартовый поворот: 1 — любой угол, 0.5 — в пределах ±90° от Поворота',
    'Rotation speed of each particle in degrees per second (negative spins the other way)':
        'Скорость вращения частицы в градусах в секунду (минус — в обратную сторону)',
    'Random spin spread per particle: 1 gives from zero to double the Spin':
        'Случайный разброс вращения на частицу: 1 даёт от нуля до двойного Вращения',
    'Turn each particle to face its direction of motion instead of using rotation and spin':
        'Разворачивать частицу по направлению движения вместо поворота и вращения',
    'Elongate particles along their velocity — faster ones stretch more (motion blur)':
        'Вытягивать частицы вдоль скорости — быстрые тянутся сильнее (моушн-блюр)',
    'Constant horizontal acceleration in px/s² (positive pulls right)':
        'Постоянное ускорение по горизонтали, px/с² (плюс тянет вправо)',
    'Constant vertical acceleration in px/s² (positive pulls down)':
        'Постоянное ускорение по вертикали, px/с² (плюс тянет вниз)',
    'Air resistance: how quickly particles lose speed (0 — none)':
        'Сопротивление среды: как быстро частицы теряют скорость (0 — нет)',
    'Noise — own wiggle per particle; Curl — a swirling field shared by neighbours (flame tongues)':
        'Шум — своё дрожание у каждой частицы; Curl — общее вихревое поле соседей (языки пламени)',
    'Strength of the turbulent push in px/s² — how hard the particles are shaken':
        'Сила турбулентного толчка в px/с² — насколько сильно трясёт частицы',
    'How fast the field boils in place': 'Как быстро поле «кипит» на месте',
    'Eddy diameter in px — roughly the width of one flame tongue':
        'Диаметр вихря в px — примерно ширина одного языка пламени',
    '1 — one big stream; 3 — big stream plus fine shredding':
        '1 — одна крупная струя; 3 — крупная струя плюс мелкая рвань',
    'The field floats up with the plume. Best at 0.6-0.7 of the particle rise speed':
        'Поле всплывает вместе с плюмом. Лучше всего 0.6–0.7 от скорости подъёма частиц',
    'The field as a medium velocity: drag pulls the particle toward the flow instead of kicking it. Needs Drag > 0.':
        'Поле как скорость среды: сопротивление тянет частицу к потоку, а не бьёт по ней. Нужно Сопротивление > 0.',
    'Different value — a different field for the same design': 'Другое значение — другое поле при том же дизайне',
    'Ramps turbulence in over the particle life: 0 — full from birth, 1 — calm at the base, shredded at the tip':
        'Разгон турбулентности по жизни частицы: 0 — в полную силу с рождения, 1 — спокойно у основания, рвано на вершине',
    'Per-step random kinks of the velocity direction (lightning)':
        'Покадровые случайные изломы направления скорости (молния)',
    'How much camera compression flattens the particle sprite': 'Насколько спрайт частицы плющится компрессией камеры',
    'Additive glow halo around each particle; above 1 adds extra passes (not for textures)':
        'Аддитивный ореол вокруг каждой частицы; больше 1 — доп. проходы (текстурам не работает)',
    'Size of the glow halo relative to the sprite size': 'Размер ореола свечения относительно размера спрайта',
    'Blur radius as a fraction of sprite size': 'Радиус блюра как доля размера спрайта',

    // инспектор: суб-эмиттер и адресация корректоров
    'Every particle of this layer emits its own particles with their own sprite, curves and physics':
        'Каждая частица слоя сама эмитит частицы — со своим спрайтом, кривыми и физикой',
    'When children are born: all at once as the parent dies, steadily during its life, or both':
        'Когда рождаются дети: разом при гибели родителя, постоянно по ходу его жизни или и так, и так',
    'Per PARENT particle — the total load scales with the number of parents':
        'На КАЖДУЮ родительскую частицу — суммарная нагрузка растёт с числом родителей',
    'Fraction of the parent life before children start spawning':
        'Какую долю жизни родителя переждать до начала эмиссии',
    'Burst emitted at the moment the parent dies': 'Сколько частиц выбросить в момент гибели родителя',
    'Where children fly: any way, along the motion of the parent, against it, or away from the emitter':
        'Куда летят дети: во все стороны, вдоль движения родителя, против него или от эмиттера',
    'Width of the random cone around the sub direction, in degrees':
        'Ширина случайного конуса вокруг суб-направления, в градусах',
    'Launch speed of child particles in pixels per second': 'Начальная скорость дочерних частиц в пикселях в секунду',
    'Random speed spread per child: 0.5 gives from 50% to 150% of Sub speed':
        'Случайный разброс скорости ребёнка: 0.5 даёт от 50% до 150% Суб-скорости',
    'How much of the parent velocity is added to the child': 'Какая доля скорости родителя добавляется ребёнку',
    'Above 1 children emit children too, reusing the same sub particle block':
        'Больше 1 — дети тоже эмитят детей, тем же блоком суб-частицы',
    'Size / life / rate multiplier applied to each deeper generation':
        'Множитель размера / жизни / темпа на каждое следующее поколение',
    'Hard cap on live child particles — over it new children are dropped':
        'Жёсткий кап живых дочерних частиц — сверх него новые не рождаются',
    'Draw the child particles beneath their parents instead of on top of them':
        'Рисовать дочерние частицы под родителями, а не поверх них',
    'Nothing checked — every matching layer below. Check layers to narrow it down':
        'Ничего не отмечено — все подходящие слои ниже. Отметьте слои, чтобы сузить выбор',
    'Include this layer; with nothing checked, every matching layer below is affected':
        'Включить этот слой; если ничего не отмечено — действует на все подходящие слои ниже',
    'Clear the checks: the layer works on every matching layer below again':
        'Снять галочки: слой снова действует на все подходящие слои ниже',
    'How the processed group composites back into the stack: the picked layers are isolated, so additive ones need Add':
        'Как обработанная группа ложится обратно в стек: выбранные слои изолируются, поэтому аддитивным нужен Add',

    // инспектор: силовое поле
    'Add one more radial field to this layer (Collapse by default)':
        'Добавить ещё одно радиальное поле в этот слой (по умолчанию Collapse)',
    'Turn this field on or off without deleting it': 'Включить или выключить поле, не удаляя его',
    'Collapse pulls to the center, Expand pushes away, Drive swirls around; negative strength flips it':
        'Collapse стягивает к центру, Expand расталкивает, Drive закручивает; отрицательная сила разворачивает',
    'Acceleration at the center of the field. Negative reverses the direction':
        'Ускорение в центре поля. Отрицательное — в обратную сторону',
    'How fast the force dies toward the edge: 0 — flat field with a hard rim, 1 — linear, 3+ — a narrow core':
        'Как быстро сила гаснет к краю: 0 — ровное поле с жёсткой кромкой, 1 — линейно, 3+ — узкое ядро',
    'Field center, px from the composition center; you can drag the field in the preview':
        'Центр поля, px от центра композиции; поле можно тянуть в превью',
    'Half-width of the area of effect: outside the ellipse the force is exactly zero':
        'Полуширина области действия: за эллипсом сила ровно ноль',
    'Half-height of the area of effect in px; on screen the camera compression flattens it':
        'Полувысота области действия в px; на экране её сплющивает компрессия камеры',
    'Delete this field from the force layer': 'Удалить это поле из силового слоя',

    // инспектор: постэффекты (смаз, искажение)
    'Which post effect processes the layers below: motion blur, turbulent displace or pixel art':
        'Какой постэффект обрабатывает слои ниже: смаз движения, турбулентное искажение или пиксель-арт',
    'Directional — one smear angle for the whole frame; Radial — zoom and spin around a center':
        'По направлению — один угол смаза на весь кадр; Радиальный — зум и вращение вокруг центра',
    'Zoom smear measured at the far corner of the frame (0 — off)':
        'Смаз зума, измеряется на дальнем углу кадра (0 — выключено)',
    'Total smear length in pixels along the blur angle (0 — off)':
        'Полная длина смаза в пикселях вдоль угла размытия (0 — выключено)',
    'Angular smear around the center': 'Угловой смаз вращением вокруг центра',
    'Center of the radial blur, px from the composition center; drag it in the preview':
        'Центр радиального смаза, px от центра композиции; его можно тянуть в превью',
    'Direction of the smear in degrees: 0 — horizontal, 90 — vertical':
        'Направление смаза в градусах: 0 — по горизонтали, 90 — по вертикали',
    'Samples are gathered by doubling passes: 16 samples cost 4 full-frame passes. Raise it if the smear looks stepped':
        'Сэмплы набираются проходами-удвоениями: 16 сэмплов = 4 прохода по кадру. Поднимать, если смаз ступенчатый',
    'Blur on a half-size buffer: 4x fewer pixels, slightly softer. Affects the exported atlas too':
        'Смаз в буфере половинного размера: вчетверо меньше пикселей, чуть мягче. Влияет и на экспортируемый атлас',
    'How far the frame is pushed. Layer opacity scales it — animate opacity to fade the distortion in':
        'На сколько гнётся кадр. Прозрачность слоя масштабирует величину — анимируйте её, чтобы вводить искажение плавно',
    'Swirl keeps the area, so no black holes appear; Tear rips sharper but can punch voids in the mass':
        'Вихревое сохраняет площадь — чёрных дыр не будет; рвущее режет резче, но может пробить пустоты в массе',
    'Horizontal size of one fold — roughly the width of a flame tongue':
        'Горизонтальный размер одной складки — примерно ширина языка пламени',
    'Vertical stretch of the folds. Fire wants 2-3: tall thin tongues, not round blobs':
        'Вытянутость складок по вертикали. Огню нужно 2–3: высокие тонкие языки, а не круглые кляксы',
    '1 — one big wave; 3 — big wave plus fine shredding': '1 — одна крупная волна; 3 — крупная волна плюс мелкая рвань',
    'How fast the folds are reborn in place': 'Как быстро складки перерождаются на месте',
    'The field floats up so the folds lick with the plume instead of standing still like wavy glass':
        'Поле уплывает вверх, и складки лижут вместе с плюмом, а не стоят волнистым стеклом',
    'Damps the distortion below the line so the flame stays welded to the ground':
        'Гасит искажение ниже линии, чтобы пламя не отрывалось от земли',
    'Height of the calm line, px from the composition center; below it the distortion is damped':
        'Высота линии успокоения, px от центра композиции; ниже неё искажение гасится',
    'Distance below the line over which the damping reaches full strength':
        'На какой высоте ниже линии успокоение выходит на полную силу',

    // инспектор: пиксель-арт
    'Pixel-art width in cells; the height follows the composition and pixel aspect. Atlas 1:1 exports it':
        'Ширина пиксель-арта в ячейках; высота — из композиции и пропорции пикселя. Атлас 1:1 отдаёт её',
    'Keep every block a whole number of composition pixels so the pixel staircase stays even':
        'Держать каждый блок целым числом пикселей композиции, чтобы лесенка пикселей шла ровно',
    'Height / width of one art pixel. 1 — square; 2 — tall pixels, a match for a compressed isometric camera':
        'Высота / ширина одного пикселя арта. 1 — квадрат; 2 — высокие пиксели, под сжатую изометрическую камеру',
    'Shift the grid inside one cell to line the blocks up with the center of the effect':
        'Сдвиг сетки в пределах ячейки — чтобы блоки совпали с центром эффекта',
    'How a block gets its color: Peak keeps bright sparks, Average is smooth, Point is the hardest':
        'Как блок берёт цвет: «Пик» бережёт яркие искры, «Среднее» мягче, «Точка» жёстче всего',
    'Multiplies alpha before the cutoff — raise it to turn thin faded strokes back into solid pixels':
        'Множитель альфы до порога — поднимите, чтобы тонкие бледные штрихи снова стали плотными пикселями',
    'Cut — 1-bit alpha like real pixel art; Steps — a few transparency levels; Soft — keep the gradient':
        'Порог — 1-битная альфа, как в настоящем пиксель-арте; Ступени — несколько уровней; Мягкая — градиент',
    'Coverage a block needs to become a pixel. Lower — fatter silhouette; animate it for a dissolve':
        'Сколько блок должен быть закрыт, чтобы стать пикселем. Ниже — жирнее силуэт; анимируйте для растворения',
    'How many transparency levels a block can take': 'Сколько уровней прозрачности может принять блок',
    'Applied before quantizing: averaging a block washes the chroma out, this puts it back':
        'Применяется до квантования: усреднение блока съедает цвет, а это его возвращает',
    'Contrast boost applied before quantizing; 1 leaves the colors unchanged':
        'Усиление контраста перед квантованием; 1 оставляет цвета как есть',
    'Reduce colors: Levels posterize the channels, Palette snaps to fixed colors, Ramp maps brightness':
        'Сокращение цветов: Уровни — постеризация, Палитра — фиксированные цвета, Рампа — по яркости',
    'How many brightness levels each color channel keeps': 'Сколько уровней яркости остаётся в каждом канале цвета',
    'Fixed palette: every pixel takes the nearest of its colors':
        'Фиксированная палитра: каждый пиксель берёт ближайший её цвет',
    'Colors for brightness: dark pixels take the left end of the gradient, bright ones the right':
        'Цвета по яркости: тёмные пиксели берут левый край градиента, светлые — правый',
    'How many separate colors are taken from the brightness ramp': 'Сколько отдельных цветов берётся из рампы яркости',
    'Ordered Bayer dither on the art grid — reads as a pixel pattern; works on colors and alpha':
        'Упорядоченный дизеринг Байера по сетке арта — читается пиксельным узором; действует на цвет и альфу',
    'Strength of the dither pattern; 0 turns dithering off': 'Сила узора дизеринга; 0 выключает дизеринг',
    'One art pixel along the silhouette — the readability trick almost every sprite sheet uses':
        'Один пиксель арта по силуэту — приём читаемости, который есть почти в каждом спрайт-листе',
    'Draw the outline outside the silhouette or along its inner edge':
        'Рисовать обводку снаружи силуэта или по его внутренней кромке',
    'Color of the one-pixel silhouette outline': 'Цвет однопиксельной обводки силуэта',
    'Atlas cell = the art grid, nearest filtering; keep this layer on top — layers above stay smooth':
        'Ячейка атласа = сетка арта, фильтр nearest; держите слой наверху — что выше, не пикселизуется',

    // инспектор: спрайт и атлас
    'Sprite image: a procedural shape or an imported texture — click to choose':
        'Картинка спрайта: процедурная фигура или импортированная текстура — клик для выбора',
    'Sprite size in pixels along its longer side, before Scale is applied':
        'Размер спрайта в пикселях по длинной стороне, до применения Масштаба',
    'Frame rate of a footage texture; 0 stretches all frames over the layer window':
        'Частота кадров футажа; 0 — растянуть все кадры на окно слоя',
    'Tint of the procedural shape; imported textures keep their own colors':
        'Цвет процедурной фигуры; импортированные текстуры сохраняют свои цвета',
    'How much camera compression flattens the sprite (1 — lying on the ground)':
        'Насколько спрайт плющится компрессией камеры (1 — лежит на земле)',
    'Additive glow halo around the shape; above 1 adds extra passes (not for textures)':
        'Аддитивный ореол вокруг фигуры; больше 1 — доп. проходы (текстурам не работает)',
    'Size multiplier on top of the base size; animate it to grow or shrink the layer':
        'Множитель поверх базового размера; анимируйте, чтобы слой рос или сжимался',
    'Width-to-height ratio: above 1 stretches the image wide, below 1 makes it tall':
        'Соотношение ширины к высоте: больше 1 растягивает вширь, меньше 1 — ввысь',
    'Rotation of the layer image in degrees (positive turns clockwise)':
        'Поворот картинки слоя в градусах (плюс — по часовой стрелке)',
    'Sprite sheet the frames come from — click to pick a texture or import a new one':
        'Лист, из которого берутся кадры — клик, чтобы выбрать текстуру или импортировать новую',
    'Open the sheet dialog: pick or drop an image and set its grid':
        'Открыть диалог листа: выбрать или бросить картинку и задать её сетку',
    'Edit the frame grid (columns, rows, fps) of the current sheet':
        'Изменить сетку кадров (колонки, ряды, fps) текущего листа',
    'On-screen size of one frame (its longer side)': 'Экранный размер одного кадра (по длинной стороне)',

    // виджеты: ключи, кривые, градиенты, пикер спрайта
    'Stopwatch: animate with keyframes; click again to drop the keys and keep the current value':
        'Секундомер: анимировать ключами; повторный клик убирает ключи, оставляя текущее значение',
    'Add a keyframe at the current time, or remove the one already there':
        'Поставить ключ в текущем времени или убрать уже стоящий там',
    'Drag a point to move it. Double-click to add or remove.': 'Драг — двигать точку. Дабл-клик — добавить/удалить.',
    'Replace the curve with a ready-made shape (fade out, grow, pulse…)':
        'Заменить кривую готовой формой (затухание, рост, импульс…)',
    'Click to add a stop. Right-click a stop to remove it.': 'Клик — добавить стоп. ПКМ по стопу — удалить.',
    'Click to pick for coloring, drag to move, right-click to remove the stop':
        'Клик — выбрать стоп для цвета, драг — двигать, ПКМ — удалить стоп',
    'Color of the selected stop (click a stop under the strip first)':
        'Цвет выбранного стопа (сначала кликните по стопу под полосой)',
    'Replace the gradient with a ready-made palette (fire, smoke, ice…)':
        'Заменить градиент готовой палитрой (огонь, дым, лёд…)',
    'A fixed shape variant, or Random to give each particle its own':
        'Фиксированный вариант фигуры или «Случайный» — у каждой частицы свой',
    'Use this imported texture as the image': 'Использовать эту импортированную текстуру как картинку',
    'Import a new sprite sheet from disk and set its grid':
        'Импортировать новый спрайт-лист с диска и задать его сетку',

    // фигуры и их параметры (sprites.js)
    'Round blob with a soft falloff — glows, smoke, energy': 'Круглое пятно с мягким спадом — свечения, дым, энергия',
    'Solid disc with a crisp edge — droplets, dots, bubbles': 'Сплошной диск с чёткой кромкой — капли, точки, пузыри',
    'Hollow ring with adjustable thickness — shockwaves and pulses':
        'Полое кольцо с настраиваемой толщиной — ударные волны, импульсы',
    'Ring band thickness as a fraction of its radius': 'Толщина полосы кольца как доля его радиуса',
    'Solid square — pixels, confetti and digital bits': 'Сплошной квадрат — пиксели, конфетти, цифровые частицы',
    'Regular polygon with an adjustable number of sides': 'Правильный многоугольник с настраиваемым числом сторон',
    'How many sides the polygon shape has': 'Сколько сторон у фигуры-многоугольника',
    'Star with adjustable points and depth — magic and sparkles':
        'Звезда с настраиваемыми лучами и глубиной — магия, блёстки',
    'How many points (rays) the star shape has': 'Сколько лучей (вершин) у фигуры-звезды',
    'Star depth: inner radius as a fraction of the outer one': 'Глубина звезды: внутренний радиус как доля внешнего',
    'Long soft streak along X — pair it with Align to velocity or Stretch':
        'Длинный мягкий штрих вдоль X — в паре с «По вектору скорости» или Растяжением',
    'Four-point glint with a bright core — twinkles and hit sparks':
        'Четырёхлучевой блик с ярким ядром — мерцание, искры от ударов',
    'Flame tongue with its tip along +X, 4 variants — use with Align to velocity':
        'Язык пламени остриём по +X, 4 варианта — с «По вектору скорости»',
    'How sharply the flame tongue narrows toward its tip': 'Насколько резко язык пламени сужается к кончику',
    'Hot white core with a soft halo — embers that burn white on Add':
        'Раскалённое белое ядро с мягким ореолом — угольки белеют на Add',
    'Cluster of soft blobs, 4 variants — smoke, dust and clouds':
        'Скопление мягких пятен, 4 варианта — дым, пыль, облака',
    'Bumpy cartoon puff with a crisp edge, 4 variants — stylized smoke':
        'Бугристый мульт-клуб с чёткой кромкой, 4 варианта — стилизованный дым',
    'Irregular sharp shard, 4 variants — debris, glass and rocks':
        'Неровный острый осколок, 4 варианта — обломки, стекло, камни',

    // превью и плеебл-вьюпорт атласа
    'Animated preview of the composition with gizmos, zoom and pan (F — fit)':
        'Анимированное превью композиции с гизмо, зумом и паном (F — вписать)',
    'The assembled sprite sheet as it will be exported, with frame playback on the side':
        'Собранный спрайт-лист в том виде, в каком уйдёт в экспорт, и проигрывание кадров сбоку',
    'Fit the view to the window (F or double-click an empty spot)':
        'Вписать вид в окно (F или дабл-клик по пустому месту)',
    'Zoom to 100% — one composition pixel per pixel of the canvas':
        'Масштаб 100% — один пиксель композиции на пиксель канвы',
    'Background under the effect — only for viewing, it never gets into the export':
        'Фон под эффектом — только для просмотра, в экспорт он не попадает',
    'Show position, fade and path controllers (drag moves them, Alt+click on the path adds a node)':
        'Показывать контроллеры позиции, затухания и пути (драг двигает, Alt+клик по пути — новый узел)',
    'Arrows showing where a resting particle is pushed: gravity, curl, wind, path pull and force fields':
        'Стрелки: куда толкнёт покоящуюся частицу — гравитация, curl, ветер, притяжение пути и силовые поля',
    'Fit the frame to the panel (double-click the frame)': 'Вписать кадр в панель (дабл-клик по кадру)',
    'Wheel — zoom, drag — pan, double-click — fit': 'Колесо — зум, драг — пан, дабл-клик — вписать',
    'Step to the previous atlas frame (playback pauses)':
        'Шаг на предыдущий кадр атласа (проигрывание встаёт на паузу)',
    'Play only the atlas frames at the panel fps, the way the game will (Space)':
        'Проиграть только кадры атласа в fps панели — так, как это сделает игра (Пробел)',
    'Step to the next atlas frame (playback pauses)': 'Шаг на следующий кадр атласа (проигрывание встаёт на паузу)',
    'Playback rate; empty — the atlas own fps (frames / range)':
        'Темп проигрывания; пусто — собственный fps атласа (кадры / диапазон)',

    // таймлайн: транспорт и добавление слоёв
    'Jump to the start of the composition (Home)': 'Перейти в начало композиции (Home)',
    'Step one frame back (Left arrow; with Shift — 10 frames)':
        'Шаг на кадр назад (стрелка влево; с Shift — 10 кадров)',
    'Play or pause the composition (Space)': 'Запустить или приостановить проигрывание (Пробел)',
    'Stop playback and return to the start': 'Остановить проигрывание и вернуться в начало',
    'Step one frame forward (Right arrow; with Shift — 10 frames)':
        'Шаг на кадр вперёд (стрелка вправо; с Shift — 10 кадров)',
    'Jump to the end of the composition (End)': 'Перейти в конец композиции (End)',
    'Loop playback: start over after the end instead of stopping':
        'Зациклить проигрывание: после конца начинать заново, а не останавливаться',
    'Current time / composition length, then the frame number': 'Текущее время / длина композиции, затем номер кадра',
    'Add a particle emitter layer above the selected layer': 'Добавить слой-эмиттер частиц над выбранным слоем',
    'Add a layer with a single sprite (a shape or a texture) above the selected one':
        'Добавить слой с одиночным спрайтом (фигура или текстура) над выбранным',
    'New sprite atlas layer (sheet frames, no preset animation)':
        'Новый слой-атлас (кадры листа, без преданимации пресета)',
    'New post-effect layer (processes everything below it)': 'Новый слой постобработки (обрабатывает всё, что под ним)',
    'New force field layer: radial fields that pull, push or swirl the particles of the emitters below':
        'Новый слой силового поля: радиальные поля, которые стягивают, расталкивают или закручивают частицы эмиттеров ниже',
    'Add a ready-made layer: flash, shockwave, fire, sparks, lightning and more':
        'Добавить готовый слой: вспышка, ударная волна, огонь, искры, молния и другие',
    'Dope sheet: keys and bars. Right-click a key for easing. Shift+click for multi-select.':
        'Dope sheet: ключи и бары. ПКМ по ключу — изинг. Shift+клик — мультивыбор слоёв.',
    'Animation graphs and over-life curves': 'Графики анимации и кривые за жизнь',

    // таймлайн: слои, бары, ключи, кривые, график
    'Emitter layer: spawns particles and simulates them': 'Слой-эмиттер: рождает частицы и симулирует их',
    'Sprite layer: a single shape or texture with an animated transform':
        'Спрайт-слой: одна фигура или текстура с анимируемым трансформом',
    'Atlas layer: plays the frames of a sprite sheet': 'Слой-атлас: проигрывает кадры спрайт-листа',
    'Post FX layer: processes the image of the layers below it':
        'Слой постэффекта: обрабатывает картинку слоёв под ним',
    'Force field layer: pushes the particles of the emitters below it':
        'Слой силового поля: толкает частицы эмиттеров под ним',
    'Click or drag to move the playhead; hold Shift to turn off frame snapping':
        'Клик или драг двигает плейхед; с зажатым Shift снэп к кадрам отключается',
    'Show or hide the animated properties and curves of this layer (U)':
        'Показать или скрыть анимированные свойства и кривые слоя (U)',
    'Show or hide the layer, both in the preview and in the export':
        'Показать или скрыть слой — и в превью, и в экспорте',
    'Solo: while any layer is soloed, only soloed layers are drawn':
        'Соло: пока у какого-то слоя включено соло, рисуются только такие слои',
    'Delete this layer (the Del key deletes all selected layers)':
        'Удалить этот слой (клавиша Del удаляет все выделенные слои)',
    'Click — select (Shift — add), double-click — rename, drag — reorder, right-click — menu':
        'Клик — выбрать (Shift — добавить), дабл-клик — переименовать, драг — порядок, ПКМ — меню',
    'Emission window — drag to move, drag an edge to trim; particles outlive its end':
        'Окно эмиссии — драг сдвигает, край подрезает; частицы доживают после конца',
    'Post-effect window — drag to move, drag an edge to trim when the effect works':
        'Окно постэффекта — драг сдвигает, край подрезает время работы эффекта',
    'Force window — drag to move, drag an edge to trim when the fields act':
        'Окно силового поля — драг сдвигает, край подрезает время действия полей',
    'Visibility window — drag to move, drag an edge to trim; all selected bars move together':
        'Окно видимости — драг сдвигает, край подрезает; выделенные бары едут вместе',
    'Animated property: click to edit its keys and curves in the graph':
        'Анимированное свойство: клик — править его ключи и кривые в графике',
    'Animated color: move its keys here, the graph does not edit colors':
        'Анимированный цвет: ключи двигаются здесь, график цвета не правит',
    'Double-click to add a key at that moment; drag the keys to move them':
        'Дабл-клик — добавить ключ в этом моменте; ключи можно перетаскивать',
    'Drag to move (selected keys move together), Shift+click adds to selection, right-click — easing':
        'Драг — сдвиг (выделенные ключи едут вместе), Shift+клик — к выделению, ПКМ — изинг',
    'Over-life curve (0..1). Click to edit in the graph.':
        'Кривая за жизнь частицы (0..1). Клик — редактировать в графике.',
    'Particle life: 0 on the left, 1 on the right. Click to open the graph.':
        'Жизнь частицы: слева 0, справа 1. Клик — в график.',
    'Particle color over life (0..1). Click the strip to add a stop, right-click removes, double-click picks a color.':
        'Цвет частицы за жизнь (0..1). Клик по полосе — добавить стоп, ПКМ — удалить, дабл-клик — цвет.',
    'Click the strip to add a color stop at that point of the particle life':
        'Клик по полосе — добавить стоп цвета в этой точке жизни частицы',
    'Drag to move. Right-click to remove. Double-click for color.': 'Драг — двигать. ПКМ — удалить. Дабл-клик — цвет.',
    'Show this property in the graph to edit its keys and Bezier handles':
        'Показать свойство в графике, чтобы править его ключи и ручки Безье',
    'Color tracks are edited in the dope sheet, not in the graph':
        'Цветовые треки правятся в dope sheet, а не в графике',
    'Show this over-life curve in the graph (X axis — particle life 0..1)':
        'Показать кривую за жизнь в графике (ось X — жизнь частицы 0..1)'
};

AFX.t = function (key) {
    if (AFX.lang === 'ru') return RU[key] || TIPS[key] || key;
    return key;
};
AFX._i18nDict = RU;    // для проверки полноты в тестах
AFX._i18nTips = TIPS;  // подсказки (tools/i18ncheck.mjs)
})();
