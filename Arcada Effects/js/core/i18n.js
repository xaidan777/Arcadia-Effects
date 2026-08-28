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
    'Save to catalog (Ctrl+S)': 'Сохранить в каталог (Ctrl+S)',
    'Unsaved changes (Ctrl+S)': 'Есть несохранённые изменения (Ctrl+S)',
    'Effect name': 'Имя эффекта',
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
    'Fit to window (double-click the preview)': 'Вписать в окно (дабл-клик по превью)',
    'Checker': 'Шахматка', 'Dark bg': 'Тёмный фон', 'Black bg': 'Чёрный фон', 'Light bg': 'Светлый фон',
    'particles': 'частиц', 'atlas': 'атлас', 'frames': 'кадров', 'cell': 'ячейка', 'footage fps': 'fps футажа',
    's': 'с', 'f': 'к', 'deg': 'град', 'px/s': 'px/с', 'color': 'цвет',
    'Accept': 'Принять', 'Cancel': 'Отмена',

    // глобальные настройки
    'Composition': 'Композиция', 'Width': 'Ширина', 'Height': 'Высота',
    'Duration': 'Длительность', 'Project FPS': 'FPS проекта',
    'Camera': 'Камера', 'Compression': 'Компрессия',
    'Camera tilt to the effect plane. 0 — side view, 37 — game isometry (scaleY 0.8).':
        'Наклон камеры к плоскости эффекта. 0 — вид сбоку, 37 — изометрия игры (scaleY 0.8).',
    'Atlas Export': 'Экспорт атласа', 'Columns': 'Колонки', 'Rows': 'Ряды', 'Frames': 'Кадров',
    'No more than cells in the grid': 'Не больше, чем ячеек в сетке',
    'Cell W': 'Ячейка W', 'Cell H': 'Ячейка H',
    '-1 — to the end of the composition': '-1 — до конца композиции',
    'Mode': 'Режим',
    'Color, transparent bg': 'Цвет, прозрачный фон',
    'Color on black': 'Цвет на чёрном',
    'Mask (white on black)': 'Маска (белое на чёрном)',
    'Mask threshold': 'Порог маски',
    '0 — soft mask, higher — hard binarization': '0 — мягкая маска, выше — жёсткая бинаризация',
    'Supersample 2x': 'Сглаживание 2x',
    'Show atlas': 'Показать атлас', 'Download PNG': 'Скачать PNG', 'Meta JSON': 'Мета JSON',
    'Save the atlas as a PNG file': 'Сохранить атлас файлом PNG',
    'Export sequence': 'Экспорт секвенции',
    'Save the effect as a numbered PNG sequence (.zip)': 'Сохранить эффект нумерованной PNG-секвенцией (.zip)',
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
    'New empty effect (current edits stay in the session)': 'Новый пустой эффект (текущие правки останутся в сессии)',
    'Import an effect from JSON': 'Импорт эффекта из JSON',
    'Export the current effect to JSON': 'Экспорт текущего эффекта в JSON',
    'Mine': 'Мои', 'Factory': 'Заводские', 'factory preset': 'заводской пресет',
    'Unsaved': 'Несохранённые', 'not saved': 'не сохранён',
    'Remove from session': 'Убрать из сессии',
    'Discard unsaved effect': 'Выбросить несохранённый эффект',
    'Empty. The Save button adds the current effect.': 'Пусто. Кнопка "Сохранить" добавит текущий эффект.',
    'Unsaved edits (kept in the session)': 'Есть несохранённые правки (живут в сессии)',
    'Open': 'Открыть',
    'Reset edits (to factory)': 'Сбросить правки (к заводскому)',
    'Reset edits (to saved)': 'Сбросить правки (к сохранённому)',
    'Delete from catalog': 'Удалить из каталога',
    'Delete effect': 'Удалить эффект',
    'Saved': 'Сохранено', 'Saved to localStorage': 'Сохранено в localStorage',
    'Server save error': 'Ошибка сохранения на сервер',
    'Failed to read the effect.': 'Не удалось прочитать эффект.',
    'File read error.': 'Ошибка чтения файла.',
    'Not an Arcaidia Effector file.': 'Файл не похож на эффект Arcaidia Effector.',
    'Failed to parse JSON.': 'Не удалось разобрать JSON.',
    'localStorage is full (likely textures). Use run.bat: the server stores effects as files.':
        'localStorage переполнен (вероятно, из-за текстур). Используй run.bat: сервер хранит эффекты в файлах.',
    'Session does not fit in localStorage: save your effects to the catalog.':
        'Сессия не влезает в localStorage: сохрани эффекты в каталог.',

    // текстуры
    'Import images (or drop files into the window)': 'Импорт картинок (или перетащи файлы в окно)',
    'No textures. Import a PNG or drop a file into the window. Drag a texture from the list into the preview or onto the timeline to create a sprite layer.':
        'Нет текстур. Импортируй PNG или перетащи файл в окно. Текстуру из списка тяни в превью или на таймлайн — создастся спрайт-слой.',
    'Drag a row into the preview or onto the timeline to create a layer.': 'Тяни строку в превью или на таймлайн — создастся слой.',
    'footage': 'футаж', 'no data': 'нет данных',
    'Mark as footage atlas: grid and fps': 'Пометить как футаж-атлас: сетка и fps',
    'Grid': 'Сетка', 'Delete texture': 'Удалить текстуру',
    'cols': 'кол.', 'rows': 'ряд.',
    'Drop to import': 'Отпусти, чтобы импортировать',
    'Add a sprite atlas: the grid is guessed from the aspect ratio and confirmed in a dialog':
        'Добавить спрайт-атлас: сетка угадывается по соотношению сторон и подтверждается в диалоге',
    'Add sprite atlas': 'Добавить спрайт-атлас', 'Atlas grid': 'Сетка атласа',
    'New sprite atlas layer (sheet frames, no preset animation)':
        'Новый слой-атлас (кадры листа, без преданимации пресета)',
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
    'On-screen size of one frame (its longer side)': 'Экранный размер одного кадра (по длинной стороне)',
    'Square cells:': 'Квадратные ячейки:',
    'the image is not evenly divisible by this grid': 'картинка не делится нацело на эту сетку',

    // инспектор
    'Select a layer to edit its parameters.': 'Выбери слой, чтобы редактировать параметры.',
    'Layer': 'Слой', 'Blend': 'Смешивание',
    'Normal': 'Обычное', 'Add (lighter)': 'Сложение (add)', 'Screen': 'Экран (screen)', 'Multiply': 'Умножение',
    'Opacity': 'Непрозрачность',
    'Start (s)': 'Начало (с)',
    'Can be negative: the simulation starts before composition zero': 'Может быть отрицательным: симуляция стартует до нуля композиции',
    'Emission end (s)': 'Конец эмиссии (с)', 'End (s)': 'Конец (с)',
    'Emitter': 'Эмиттер', 'Shape': 'Форма',
    'Point': 'Точка', 'Circle / Ellipse': 'Круг / эллипс', 'Box': 'Прямоугольник', 'Line': 'Линия',
    'Position X': 'Позиция X', 'Position Y': 'Позиция Y',
    'Size X': 'Размер X', 'Size Y': 'Размер Y',
    'Radius / half-width of the shape. For a ring: radius.': 'Радиус / полуширина формы. Для кольца — радиус.',
    'Half-height. For a ring: thickness.': 'Полувысота. Для кольца — толщина.',
    'Direction': 'Направление',
    'Outward': 'Наружу', 'Inward': 'Внутрь', 'Omni': 'Во все стороны', 'By angle': 'По углу',
    'Angle': 'Угол', 'Angle spread': 'Разброс угла',
    'Speed': 'Скорость', 'Speed random': 'Случайность скор.',
    'Rate (per sec)': 'Поток (частиц/с)',
    'Smooth emission': 'Плавная эмиссия',
    'Each particle is born at its own moment inside the simulation step, on the emitter pose of that moment. Removes the rows a fast-moving emitter or path leaves behind. Bursts are not affected.': 'Каждая частица рождается в свой момент внутри шага симуляции и на позе эмиттера этого момента. Убирает ряды, которые оставляет быстро движущийся эмиттер или путь. На вспышки не влияет.',
    'Particle': 'Частица', 'Sprite': 'Спрайт',
    'Life (s)': 'Жизнь (с)', 'Life random': 'Случайность жизни',
    'Size': 'Размер', 'Size random': 'Случайность разм.',
    'Size over life': 'Размер за жизнь',
    'Size over trail': 'Размер вдоль трейла',
    'Width along the trail: 0 — start (base), 1 — tip': 'Ширина вдоль трейла: 0 — начало (основание), 1 — кончик',
    'Opacity over life': 'Прозрачность за жизнь',
    'Color over life': 'Цвет за жизнь',
    'Tint texture': 'Тонировать текстуру',
    'Footage FPS': 'FPS футажа',
    '0 — stretch frames over particle life': '0 — растянуть кадры на жизнь частицы',
    '0 — stretch frames over layer duration': '0 — растянуть кадры на длительность слоя',
    'Rotation & Shape': 'Вращение и форма',
    'Rotation': 'Поворот', 'Random rotation': 'Случайный поворот',
    'Spin (deg/s)': 'Вращение (град/с)', 'Spin random': 'Случайность вращ.',
    'Align to velocity': 'По вектору скорости',
    'Stretch': 'Растяжение',
    'Stretch along velocity (motion blur)': 'Вытягивание вдоль скорости (моушн-блюр)',
    'Physics': 'Физика',
    'Gravity X': 'Гравитация X', 'Gravity Y': 'Гравитация Y',
    'Drag': 'Сопротивление', 'Turbulence': 'Турбулентность', 'Turb. frequency': 'Частота турб.',
    'How fast the field boils in place': 'Как быстро поле «кипит» на месте',
    'Turbulence type': 'Тип турбулентности',
    'Noise (per particle)': 'Шум (на частицу)',
    'Curl field (vortices)': 'Curl-поле (вихри)',
    'Noise — independent wiggle per particle. Curl — a swirling field in world space: neighbours travel together, which is what makes flame tongues.':
        'Шум — независимое дрожание у каждой частицы. Curl — вихревое поле в мировых координатах: соседние частицы едут вместе, отсюда языки пламени.',
    'Vortex size': 'Размер вихря',
    'Eddy diameter in px — roughly the width of one flame tongue': 'Диаметр вихря в px — примерно ширина одного языка пламени',
    'Turb. octaves': 'Октавы турб.',
    '1 — one big stream; 3 — big stream plus fine shredding': '1 — одна крупная струя; 3 — крупная струя плюс мелкая рвань',
    'Field rise (px/s)': 'Всплытие поля (px/с)',
    'The field floats up with the plume. Best at 0.6-0.7 of the particle rise speed':
        'Поле всплывает вместе с плюмом. Лучше всего 0.6–0.7 от скорости подъёма частиц',
    'Wind (px/s)': 'Ветер (px/с)',
    'The field as a medium velocity: drag pulls the particle toward the flow instead of kicking it. Needs Drag > 0.':
        'Поле как скорость среды: сопротивление тянет частицу к потоку, а не бьёт по ней. Нужно Сопротивление > 0.',
    'Field seed': 'Сид поля',
    'Different value — a different field for the same design': 'Другое значение — другое поле при том же дизайне',
    'Laminar base': 'Ламинарное основание',
    // постэффект искажения
    'Post effect': 'Постэффект', 'Effect': 'Эффект',
    'Turbulent displace': 'Турбулентное искажение',
    'Amount': 'Величина',
    'How far the frame is pushed. Layer opacity scales it — animate opacity to fade the distortion in':
        'На сколько гнётся кадр. Прозрачность слоя масштабирует величину — анимируйте её, чтобы вводить искажение плавно',
    'Displace amount': 'Величина искажения',
    'Field': 'Поле',
    'Swirl (no holes)': 'Вихревое (без дыр)', 'Tear (sharper rips)': 'Рвущее (резче разрывы)',
    'Swirl — divergence-free: area is preserved, so the image is never torn into black holes. Tear — independent noise per axis: sharper rips, but it can punch voids in the mass':
        'Вихревое — бездивергентное: площадь сохраняется, картинку не рвёт на чёрные дыры. Рвущее — свой шум по каждой оси: разрывы резче, но в массе могут появляться дыры',
    'Fold size': 'Размер складки',
    'Horizontal size of one fold — roughly the width of a flame tongue':
        'Горизонтальный размер одной складки — примерно ширина языка пламени',
    'Fold stretch': 'Вытянутость складки',
    'Vertical stretch of the folds. Fire wants 2-3: tall thin tongues, not round blobs':
        'Вытянутость складок по вертикали. Огню нужно 2–3: высокие тонкие языки, а не круглые кляксы',
    'Detail octaves': 'Октавы детализации',
    'How fast the folds are reborn in place': 'Как быстро складки перерождаются на месте',
    'Evolution (Hz)': 'Перерождение (Гц)',
    'The field floats up so the folds lick with the plume instead of standing still like wavy glass':
        'Поле уплывает вверх, и складки лижут вместе с плюмом, а не стоят волнистым стеклом',
    'Calm base': 'Спокойное основание',
    'Calm amount': 'Сила успокоения',
    'Damps the distortion below the line so the flame stays welded to the ground':
        'Гасит искажение ниже линии, чтобы пламя не отрывалось от земли',
    'Calm line Y': 'Линия успокоения Y',
    'Calm falloff': 'Спад успокоения',
    'Distance below the line over which the damping reaches full strength':
        'На какой высоте ниже линии успокоение выходит на полную силу',
    'Ramps turbulence in over the particle life: 0 — full from birth, 1 — calm at the base, shredded at the tip':
        'Разгон турбулентности по жизни частицы: 0 — в полную силу с рождения, 1 — спокойно у основания, рвано на вершине',
    'Appearance': 'Вид',
    'Sprite squash': 'Сжатие спрайта',
    'How much camera compression flattens the particle sprite': 'Насколько спрайт частицы плющится компрессией камеры',
    'How much camera compression flattens the sprite (1 — lying on the ground)': 'Насколько спрайт плющится компрессией камеры (1 — лежит на земле)',
    'Glow': 'Свечение',
    'Above 1 — extra additive passes': 'Больше 1 — дополнительные аддитивные проходы',
    'Glow size': 'Размер свечения', 'Glow softness': 'Мягкость свечения',
    'Blur radius as a fraction of sprite size': 'Радиус блюра как доля размера спрайта',
    'Radial fade': 'Радиальное затухание',
    'Fade the whole layer by distance from a movable center (drag the orange gizmo in the preview)':
        'Затухание всего слоя по расстоянию от подвижного центра (тяни оранжевое гизмо в превью)',
    'Fade X': 'Затухание: X', 'Fade Y': 'Затухание: Y', 'Fade radius': 'Затухание: радиус',
    'Softness': 'Мягкость',
    'Soft edge as a fraction of the radius (0 — hard cut)': 'Мягкая кромка как доля радиуса (0 — жёсткий срез)',
    'Gizmos': 'Гизмо',
    'Show position, fade and path controllers (drag moves them, Alt+click on the path adds a node)':
        'Показывать контроллеры позиции, затухания и пути (драг двигает, Alt+клик по пути — новый узел)',
    'Layer glow': 'Свечение слоя',

    // постэффекты (слой Post FX)
    'Post FX': 'Пост-эффект',
    'New post-effect layer (processes everything below it)': 'Новый слой постобработки (обрабатывает всё, что под ним)',
    'Post-effect window': 'Окно постэффекта',
    'Effect strength': 'Сила эффекта',
    'Mix of the processed frame with the clean one (0 — bypass)': 'Подмешивание обработанного кадра к чистому (0 — байпас)',
    'Motion blur': 'Смаз движения',
    'Directional — one smear angle for the whole frame; Radial — zoom and spin around a center':
        'Directional — один угол смаза на весь кадр; Radial — зум и вращение вокруг центра',
    'Directional': 'По направлению',
    'Radial (zoom / spin)': 'Радиальный (зум / вращение)',
    'Length': 'Длина',
    'Total smear length (0 — off)': 'Полная длина смаза (0 — выключено)',
    'Zoom smear measured at the far corner of the frame (0 — off)': 'Смаз зума, измеряется на дальнем углу кадра (0 — выключено)',
    'Spin': 'Вращение',
    'Angular smear around the center': 'Угловой смаз вокруг центра',
    'Center X': 'Центр X', 'Center Y': 'Центр Y',
    'Blur length': 'Длина смаза', 'Blur angle': 'Угол смаза',
    'Quality': 'Качество',
    'Samples': 'Сэмплы',
    'Samples are gathered by doubling passes: 16 samples cost 4 full-frame passes. Raise it if the smear looks stepped':
        'Сэмплы набираются проходами-удвоениями: 16 сэмплов = 4 прохода по кадру. Поднимать, если смаз ступенчатый',
    'Half resolution': 'Половинное разрешение',
    'Blur on a half-size buffer: 4x fewer pixels, slightly softer. Affects the exported atlas too':
        'Смаз в буфере половинного размера: вчетверо меньше пикселей, чуть мягче. Влияет и на экспортируемый атлас',
    'Glow radius (px)': 'Радиус свечения (px)',
    'Post-process: blurred additive glow of the whole layer (best for trails)': 'Постобработка: блюр-свечение всего слоя аддитивно (лучше всего для трейлов)',
    'Render': 'Рендер', 'Trail (path line)': 'Трейл (линия пути)',
    'Trail core': 'Белое ядро трейла',
    'White core line on top of the trail (lightning)': 'Белая линия-ядро поверх трейла (молния)',
    'Zigzag (deg/s)': 'Зигзаг (град/с)',
    'Per-step random kinks of the velocity direction (lightning)': 'Покадровые случайные изломы направления скорости (молния)',
    'Branching': 'Ветвление',
    'Branch chance (per sec)': 'Шанс ветки (в сек)',
    'Each particle may spawn a branch from its position': 'Частица может породить ответвление из своей позиции',
    'Branch spread': 'Разброс ветки',
    'Branch life scale': 'Жизнь ветки, доля',
    'Branch size scale': 'Толщина ветки, доля',
    'Branch speed scale': 'Скорость ветки, доля',
    'Max generations': 'Макс. поколений',
    'How deep branches can branch further': 'Насколько глубоко ветки могут ветвиться дальше',
    'Lightning': 'Молния',

    // суб-эмиттер
    'Sub-emitter': 'Суб-эмиттер',
    'Enable sub-emitter': 'Включить суб-эмиттер',
    'Every particle of this layer emits its own particles with their own sprite, curves and physics':
        'Каждая частица слоя сама эмитит частицы — со своим спрайтом, кривыми и физикой',
    'Emit': 'Эмиссия',
    'At parent death': 'При гибели родителя',
    'Along parent life': 'По ходу жизни родителя',
    'Both': 'И то, и другое',
    'Sub rate (per sec)': 'Суб-темп (в сек)',
    'Per PARENT particle — the total load scales with the number of parents':
        'На КАЖДУЮ родительскую частицу — суммарная нагрузка растёт с числом родителей',
    'Start at (life)': 'Начинать с (доля жизни)',
    'Fraction of the parent life before children start spawning':
        'Какую долю жизни родителя переждать до начала эмиссии',
    'Count at death': 'Выброс при гибели',
    'Burst emitted at the moment the parent dies': 'Сколько частиц выбросить в момент гибели родителя',
    'Sub direction': 'Суб-направление',
    'Along parent velocity': 'Вдоль скорости родителя',
    'Opposite parent velocity': 'Против скорости родителя',
    'Away from emitter': 'От центра эмиттера',
    'Sub spread': 'Суб-разброс',
    'Sub speed': 'Суб-скорость',
    'Sub speed random': 'Разброс суб-скорости',
    'Inherit velocity': 'Наследование скорости',
    'How much of the parent velocity is added to the child': 'Какая доля скорости родителя добавляется ребёнку',
    'Above 1 children emit children too, reusing the same sub particle block':
        'Больше 1 — дети тоже эмитят детей, тем же блоком суб-частицы',
    'Generation scale': 'Масштаб поколения',
    'Size / life / rate multiplier applied to each deeper generation':
        'Множитель размера / жизни / темпа на каждое следующее поколение',
    'Sub budget': 'Суб-бюджет',
    'Hard cap on live child particles — over it new children are dropped':
        'Жёсткий кап живых дочерних частиц — сверх него новые не рождаются',
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
    'Animate parameter': 'Анимировать параметр',
    'Key at current time': 'Ключ в текущем времени',
    'Animate color': 'Анимировать цвет',
    'Drag a point to move it. Double-click to add or remove.': 'Драг — двигать точку. Дабл-клик — добавить/удалить.',
    'Curve preset...': 'Пресет кривой...',
    'Gradient preset...': 'Пресет градиента...',
    'Click to add a stop. Right-click a stop to remove it.': 'Клик — добавить стоп. ПКМ по стопу — удалить.',
    'Shapes': 'Фигуры',
    'No textures yet. Import them in the Textures panel.': 'Нет текстур. Импорт — в панели "Текстуры".',
    'Random': 'Случайный', 'Variant': 'Вариант',
    'Emission bursts: time (s) / count': 'Вспышки эмиссии: время (с) / частиц',
    'Burst': 'Вспышка', 'Delete burst': 'Удалить вспышку',
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
    'To start (Home)': 'В начало (Home)',
    'Frame back (Left arrow)': 'Кадр назад (стрелка влево)',
    'Play / pause (Space)': 'Плей / пауза (Пробел)',
    'Stop (to start)': 'Стоп (в начало)',
    'Frame forward (Right arrow)': 'Кадр вперёд (стрелка вправо)',
    'To end (End)': 'В конец (End)',
    'Loop': 'Луп',
    'New particle emitter': 'Новый эмиттер частиц',
    'New sprite layer': 'Новый спрайт-слой',
    'Layer from preset': 'Слой из пресета',
    'Presets': 'Пресеты',
    'Dope sheet: keys and bars. Right-click a key for easing. Shift+click for multi-select.':
        'Dope sheet: ключи и бары. ПКМ по ключу — изинг. Shift+клик — мультивыбор слоёв.',
    'Animation graphs and over-life curves': 'Графики анимации и кривые за жизнь',
    'Layers': 'Слои', 'Graph': 'График',
    'No layers. Add buttons are at the top of the timeline.': 'Слоёв нет. Кнопки добавления — сверху на таймлайне.',
    'Expand parameters (U)': 'Раскрыть параметры (U)',

    // шпаргалка по хоткеям на таймлайне (клавиша + действие)
    'Space': 'Пробел', 'Del': 'Del',
    'Shift+click': 'Shift+клик', 'Shift+drag': 'Shift+драг',
    'RMB key': 'ПКМ по ключу', 'Ctrl+wheel': 'Ctrl+колесо',
    'MMB drag': 'СКМ драг', 'MMB click': 'СКМ клик', 'Dbl-click': 'Дабл-клик',
    'play': 'плей', 'parameters': 'параметры', 'delete': 'удалить',
    'multi-select': 'мультивыбор', 'easing': 'изинг', 'zoom': 'зум',
    'pan': 'пан', 'reset view': 'сброс вида', 'no snap': 'без снэпа',
    'add / remove point': 'добавить / удалить точку',
    'Layer visibility': 'Видимость слоя', 'Solo': 'Соло',
    'Delete layer (Del)': 'Удалить слой (Del)',
    'Rename': 'Переименовать', 'Duplicate': 'Дублировать',
    'Move up': 'Выше', 'Move down': 'Ниже', 'Delete': 'Удалить',
    'Emission window (particles outlive it)': 'Окно эмиссии (частицы доживают после)',
    'Visibility window': 'Окно видимости',
    'Click to open in the graph': 'Клик — открыть в графике',
    'Linear': 'Линейный', 'Easy Ease': 'Плавный (Easy Ease)', 'Easy In': 'Плавный вход (Easy In)',
    'Easy Out': 'Плавный выход (Easy Out)', 'Hold / Flat': 'Ступенька (Hold / Flat)',
    'Delete key(s)': 'Удалить ключ(и)',
    'Over-life curve (0..1). Click to edit in the graph.': 'Кривая за жизнь частицы (0..1). Клик — редактировать в графике.',
    'Particle life: 0 on the left, 1 on the right. Click to open the graph.': 'Жизнь частицы: слева 0, справа 1. Клик — в график.',
    'Particle color over life (0..1). Click the strip to add a stop, right-click removes, double-click picks a color.':
        'Цвет частицы за жизнь (0..1). Клик по полосе — добавить стоп, ПКМ — удалить, дабл-клик — цвет.',
    'Drag to move. Right-click to remove. Double-click for color.': 'Драг — двигать. ПКМ — удалить. Дабл-клик — цвет.',
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
    'Animated path: particles are born along it and/or follow it (drag the nodes in the preview)':
        'Анимируемый путь: частицы рождаются вдоль него и/или следуют по нему (узлы двигаются в превью)',
    'Path mode': 'Режим пути',
    'Emit — the emitter shape is replaced by the path; Guide — particles are pulled along it':
        'Эмиссия — путь заменяет форму эмиттера; Ведение — путь тянет частицы за собой',
    'Emit along path': 'Эмиссия вдоль пути',
    'Guide particles': 'Ведение частиц',
    'Emit and guide': 'Эмиссия и ведение',
    'Smooth curve': 'Сглаженная кривая',
    'Catmull-Rom curve through the nodes (from 3 nodes) — off gives a straight polyline':
        'Кривая Catmull-Rom через узлы (от 3 узлов); выкл — прямая ломаная',
    'Closed path': 'Замкнутый путь',
    'Nodes — offsets from the emitter position': 'Узлы — смещения от позиции эмиттера',
    'Node': 'Узел',
    'Delete node': 'Удалить узел',
    'Spawn along': 'Раскладка рождения',
    'Even': 'Равномерно',
    'At path start': 'В начале пути',
    'Spawn jitter': 'Разброс рождения',
    'Scatter of the birth point across the path': 'Разброс точки рождения поперёк пути',
    'Emit direction': 'Направление вылета',
    'Where the path aims new particles; the emitter Direction is used when this is off':
        'Куда путь направляет новые частицы; выкл — работает Направление эмиттера',
    'Use emitter direction': 'Направление эмиттера',
    'Along the path': 'Вдоль пути',
    'Across the path': 'Поперёк пути',
    'Attract': 'Притяжение',
    'Spring pulling particles to the nearest point of the path (damped by Drag)':
        'Пружина к ближайшей точке пути (гасится Сопротивлением)',
    'Lock to path': 'Прилипание к пути',
    'Hard follow: 1 — particles stick to the path and move only along it':
        'Жёсткое следование: 1 — частица приклеена к пути и движется только вдоль него',
    'Flow speed': 'Скорость потока',
    'Fast search': 'Быстрый поиск',
    'Look for the nearest point of the path next to the previous one — about 3x cheaper on rewind, same result on paths that do not cross themselves. Turn off for a strict global search.':
        'Искать ближайшую точку пути рядом с прошлой — примерно втрое дешевле на перемотке, на путях без самопересечений результат тот же. Выключить — строгий глобальный поиск.',
    'Speed along the path tangent (negative — backwards)': 'Скорость вдоль касательной пути (минус — назад)',
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

    // статусы
    'Copied layers': 'Скопировано слоёв',
    'Pasted layers': 'Вставлено слоёв',
    'Meta copied to clipboard': 'Мета скопирована в буфер'
};

AFX.t = function (key) {
    if (AFX.lang === 'ru') return RU[key] || key;
    return key;
};
AFX._i18nDict = RU; // для проверки полноты в тестах
})();
