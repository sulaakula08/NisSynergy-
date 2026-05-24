import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

const LS_EVENTS = 'saqta-events'
const LS_FRIENDS = 'saqta-friends'
const LS_COURSES = 'saqta-courses-enrolled'
const LS_PROGRESS = 'saqta-progress-v2'
const LS_CHAT = 'saqta-chat-v1'
const LS_NICKNAME = 'saqta-nickname'

/** Якоря навбара: id секции → подпись */
const NAV_SECTIONS = [
  { id: 'feed', label: 'Лента' },
  { id: 'chat', label: 'Чат' },
  { id: 'mission', label: 'Цель' },
  { id: 'events', label: 'События' },
  { id: 'friends', label: 'Друзья' },
  { id: 'robot', label: 'Робот' },
  { id: 'courses', label: 'Курсы' },
  { id: 'quiz', label: 'Викторина' },
  { id: 'team', label: 'Команда' },
] as const

type EcoEvent = { id: string; title: string; date: string; note?: string }
type Friend = { id: string; name: string; email?: string }

type FeedKind = 'cleanup' | 'monitoring' | 'lecture' | 'plastic'

type CityFeedItem = {
  id: string
  kind: FeedKind
  title: string
  place: string
  when: string
  xp: number
  blurb: string
}

type ChatMsg = { id: string; author: string; text: string; at: string; system?: boolean }

type ProgressState = {
  xp: number
  feedTaken: string[]
  quizPaidDay: string | null
  robotPaidDay: string | null
  courseXpPaid: string[]
}

function isoDay(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function loadProgress(): ProgressState {
  const fallback: ProgressState = {
    xp: 0,
    feedTaken: [],
    quizPaidDay: null,
    robotPaidDay: null,
    courseXpPaid: [],
  }
  try {
    const raw = localStorage.getItem(LS_PROGRESS)
    if (!raw) return fallback
    const p = JSON.parse(raw) as Partial<ProgressState>
    return {
      ...fallback,
      ...p,
      feedTaken: Array.isArray(p.feedTaken) ? p.feedTaken : [],
      courseXpPaid: Array.isArray(p.courseXpPaid) ? p.courseXpPaid : [],
    }
  } catch {
    return fallback
  }
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function daySeed(date = new Date()): number {
  return date.getFullYear() * 10_000 + (date.getMonth() + 1) * 100 + date.getDate()
}

function levelBand(xp: number): {
  level: number
  title: string
  current: number
  nextGoal: number
  segmentStart: number
} {
  const step = (lv: number) => Math.min(560, Math.round(120 + lv * 42 + lv ** 1.4 * 8))
  let lv = 1
  let start = 0
  while (xp >= start + step(lv)) {
    start += step(lv)
    lv++
    if (lv > 999) break
  }
  const span = Math.max(120, Math.round(step(lv)))
  const RANK = [
    'Наблюдатель',
    'Волонтёр',
    'Хранитель берега',
    'Наставник Есиля',
    'Активист столицы',
    'Страж голубых зон',
    'Легенда потоков',
  ]
  const title = RANK[Math.min(lv - 1, RANK.length - 1)]!
  return { level: lv, title, current: xp - start, nextGoal: span, segmentStart: start }
}

const ASTANA_FEED: CityFeedItem[] = [
  {
    id: 'ast-yesile-cleanup-may',
    kind: 'cleanup',
    title: 'Выход на наблюдаемый участок р. Есиль',
    place: 'Нас. пункт Нура · набережная',
    when: 'Сб 10:00',
    xp: 55,
    blurb:
      'Сбор плавающего мусора и пластиковых вкладышей у опорных кустовников. Выдаём перчатки и биомешки.',
  },
  {
    id: 'ast-koysai-lake-may',
    kind: 'cleanup',
    title: 'Уборка озера Коянды',
    place: 'Юго-восток Астаны',
    when: 'Вс 09:30',
    xp: 70,
    blurb:
      'Работа с прибрежными заторовыми точками, фиксируем микропластик и крупное — отдельно по мешкам.',
  },
  {
    id: 'ast-micro-field',
    kind: 'monitoring',
    title: 'Полевая точка наблюдений у пруда в EXPO‑квартале',
    place: 'Между жилых кварталов к северу',
    when: 'Пт 18:40',
    xp: 40,
    blurb:
      'Полуторачасовой протокол: отметки температуры, наличие плёнки, фото для карты робота-патруля.',
  },
  {
    id: 'ast-botanical-spring',
    kind: 'lecture',
    title: 'Мини-лекция у родниковой зоны ботсада',
    place: 'Ботанический сад имени Есимова',
    when: 'Чт 19:15',
    xp: 35,
    blurb:
      'Как ветви и упаковка превращаются в микрочастицы в переходную погоду. Вход свободный.',
  },
  {
    id: 'ast-presidential-park',
    kind: 'plastic',
    title: 'Субботний обход акватории у паркового русла',
    place: 'Парк у Байтерека · левый берег магистрали воды',
    when: 'Сб 11:30',
    xp: 50,
    blurb:
      'Коридор для активистов: раздельное ведение синтетики и органики, сбор для лабораторного чек-листа Saqta.',
  },
  {
    id: 'ast-saryarka-channel',
    kind: 'cleanup',
    title: 'Добровольческий патч у дренажной линии',
    place: 'Район ЖК «Comfort City» · лоток',
    when: 'Вт 08:45',
    xp: 60,
    blurb:
      'Предупреждение размыва песка после дождей и быстрый забор упаковок до ухода в основное русло.',
  },
]

const FEED_KIND_LABEL: Record<FeedKind, string> = {
  cleanup: 'Уборка воды',
  monitoring: 'Наблюдение',
  lecture: 'Открытый ум',
  plastic: 'Пластик-фокус',
}

const QUIZ_BANK = [
  {
    question: 'Какой объект чаще всего превращается в микропластик в воде?',
    options: ['Целое стекло', 'Отбеленная бумага', 'Синтетические волокна одежды', 'Яблочная кожура'],
    correct: 2,
    explain:
      'Синтетические ткани при стирке и износ отдают частицы, которые попадают в стоки и реки.',
  },
  {
    question: 'Что лучше сделать с пластиковой упаковкой у воды?',
    options: [
      'Выбросить в лесной ручей «чтобы унесло»',
      'Сжечь у берега',
      'Сдать во вторсырьё или в контейнер по правилам региона',
      'Оставить на пляже на ночь',
    ],
    correct: 2,
    explain: 'Сбор и переработка снижают попадание пластика в водоёмы.',
  },
  {
    question: 'Почему микропластик опасен для водных экосистем?',
    options: [
      'Он растворяется и исчезает за сутки',
      'Может накапливаться в пищевых цепочках',
      'Улучшает прозрачность воды',
      'Поглощает только кислород из воздуха',
    ],
    correct: 1,
    explain: 'Частицы попадают в организмы и накапливаются при поедании.',
  },
]

const ECO_COURSES = [
  {
    id: 'rivers-101',
    title: 'Чистые реки с нуля',
    duration: '3 модуля · 45 минут',
    blurb:
      'Как отследить локальные выбросы, работать с волонтёрами и фиксировать загрязнение.',
  },
  {
    id: 'plastic-trail',
    title: 'След микропластика',
    duration: '2 модуля · 35 минут',
    blurb: 'От стока дома до устья: как части попадают в воду и что измерять в полевых заметках.',
  },
  {
    id: 'community-labs',
    title: 'Комьюнити-наблюдения',
    duration: '4 модуля · 55 минут',
    blurb: 'Простые методики наблюдений у источников, безопасный сбор проб и журнал активности.',
  },
]

const CHAT_BOOT: Omit<ChatMsg, 'mine'>[] = [
  {
    id: 'boot-1',
    author: 'Куратор Saqta',
    text:
      'Добро пожаловать в общий чат волонтёров и активистов Астаны. Делитесь маршрутами, временем выходов и наблюдениями у русел.',
    at: new Date(Date.now() - 86_400_000 * 3).toISOString(),
    system: true,
  },
  {
    id: 'boot-2',
    author: 'Айгерим В.',
    text: 'На Нуре нашли уплотнённый пластик после ветерка — уже отметила на карте патруля.',
    at: new Date(Date.now() - 52_600_000).toISOString(),
  },
  {
    id: 'boot-3',
    author: 'Данияр А.',
    text: 'Подвезу сумки вторником к лотку у Comfort City — кто там будет?',
    at: new Date(Date.now() - 36_900_000).toISOString(),
  },
]

function hydrateChat(messages: ChatMsg[]): ChatMsg[] {
  const map = new Map(messages.map((m) => [m.id, m]))
  const ordered: ChatMsg[] = [...messages]
  for (const b of CHAT_BOOT) {
    if (!map.has(b.id)) ordered.unshift({ ...b })
  }
  return ordered.sort((a, z) => +new Date(a.at) - +new Date(z.at))
}

export function App() {
  const [navScrolled, setNavScrolled] = useState(false)
  const [navMobileOpen, setNavMobileOpen] = useState(false)
  const [activeNavId, setActiveNavId] = useState<string | null>(null)

  const [progress, setProgress] = useState<ProgressState>(() => loadProgress())
  const [events, setEvents] = useState<EcoEvent[]>(() => loadJSON(LS_EVENTS, []))
  const [friends, setFriends] = useState<Friend[]>(() => loadJSON(LS_FRIENDS, []))
  const [enrolled, setEnrolled] = useState<string[]>(() => loadJSON(LS_COURSES, []))
  const [chat, setChat] = useState<ChatMsg[]>(() => hydrateChat(loadJSON(LS_CHAT, [])))

  const [nickname, setNickname] = useState(() => loadJSON(LS_NICKNAME, 'Ваше имя в чате'))
  const [chatDraft, setChatDraft] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [evtTitle, setEvtTitle] = useState('')
  const [evtDate, setEvtDate] = useState('')
  const [evtNote, setEvtNote] = useState('')
  const [frName, setFrName] = useState('')
  const [frEmail, setFrEmail] = useState('')
  const [robotPrompt, setRobotPrompt] = useState('')
  const [robotStatus, setRobotStatus] = useState<string | null>(null)

  const [picked, setPicked] = useState<number | null>(null)

  const quiz = useMemo(() => QUIZ_BANK[daySeed() % QUIZ_BANK.length]!, [])

  const [toast, setToast] = useState<string | null>(null)

  const band = useMemo(() => levelBand(progress.xp), [progress.xp])
  const pct = band.nextGoal > 0 ? Math.min(100, Math.round((band.current / band.nextGoal) * 100)) : 100

  const pushToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3400)
  }

  const addXp = useCallback((amount: number, label: string) => {
    if (amount <= 0) return
    setProgress((p) => ({ ...p, xp: p.xp + amount }))
    pushToast(`+${amount} XP · ${label}`)
  }, [])

  useEffect(() => {
    localStorage.setItem(LS_PROGRESS, JSON.stringify(progress))
  }, [progress])

  useEffect(() => {
    localStorage.setItem(LS_EVENTS, JSON.stringify(events))
  }, [events])

  useEffect(() => {
    localStorage.setItem(LS_FRIENDS, JSON.stringify(friends))
  }, [friends])

  useEffect(() => {
    localStorage.setItem(LS_COURSES, JSON.stringify(enrolled))
  }, [enrolled])

  useEffect(() => {
    localStorage.setItem(LS_CHAT, JSON.stringify(chat))
  }, [chat])

  useEffect(() => {
    localStorage.setItem(LS_NICKNAME, JSON.stringify(nickname))
  }, [nickname])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setNavMobileOpen(false)
  }, [])

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setNavMobileOpen(false)
    setActiveNavId(null)
  }, [])

  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        setNavScrolled(window.scrollY > 12)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    const sectionEls = NAV_SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[]
    if (sectionEls.length === 0) return

    const pickActive = () => {
      if (window.scrollY < 64) {
        setActiveNavId((prev) => (prev !== null ? null : prev))
        return
      }
      const line = Math.min(120, Math.round(window.innerHeight * 0.22))
      let bestId: string | null = null
      let bestDist = Number.POSITIVE_INFINITY
      for (const el of sectionEls) {
        const r = el.getBoundingClientRect()
        const dist = Math.abs(r.top - line)
        if (r.bottom > line && r.top < window.innerHeight * 0.88 && dist < bestDist) {
          bestDist = dist
          bestId = el.id
        }
      }
      setActiveNavId((prev) => (prev === bestId ? prev : bestId))
    }

    pickActive()
    window.addEventListener('scroll', pickActive, { passive: true })
    window.addEventListener('resize', pickActive)
    return () => {
      window.removeEventListener('scroll', pickActive)
      window.removeEventListener('resize', pickActive)
    }
  }, [])

  /** Появление секций при скролле (как лёгкий motion у Notion) */
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('reveal--in'))
      return
    }
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('reveal--in')
          obs.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    nodes.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!navMobileOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [navMobileOpen])

  const takeFeed = (item: CityFeedItem) => {
    setProgress((p) => {
      if (p.feedTaken.includes(item.id)) return p
      window.setTimeout(
        () => pushToast(`+${item.xp} XP · «${item.title.slice(0, 28)}${item.title.length > 28 ? '…' : ''}»`),
        0,
      )
      return { ...p, feedTaken: [...p.feedTaken, item.id], xp: p.xp + item.xp }
    })
  }

  const addEvent = (e: FormEvent) => {
    e.preventDefault()
    if (!evtTitle.trim() || !evtDate.trim()) return
    setEvents((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: evtTitle.trim(),
        date: evtDate.trim(),
        note: evtNote.trim() || undefined,
      },
    ])
    setEvtTitle('')
    setEvtDate('')
    setEvtNote('')
    addXp(24, 'Личное экособытие запланировано')
  }

  const addFriend = (e: FormEvent) => {
    e.preventDefault()
    if (!frName.trim()) return
    setFriends((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: frName.trim(), email: frEmail.trim() || undefined },
    ])
    setFrName('')
    setFrEmail('')
    addXp(12, 'Друг добавлен в сеть')
  }

  const sendRobot = (e: FormEvent) => {
    e.preventDefault()
    if (!robotPrompt.trim()) return
    const today = isoDay()
    setProgress((p) => {
      if (p.robotPaidDay === today) return p
      window.setTimeout(() => pushToast('+18 XP · Сигнал роботу-патрулю'), 0)
      return { ...p, robotPaidDay: today, xp: p.xp + 18 }
    })
    setRobotStatus('Запрос принят — робот поставлен в очередь на патруль источников.')
    setRobotPrompt('')
    window.setTimeout(() => setRobotStatus(null), 5000)
  }

  const toggleCourse = (id: string) => {
    setEnrolled((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)

      setProgress((prog) => {
        if (prog.courseXpPaid.includes(id)) return prog
        window.setTimeout(() => pushToast('+28 XP · Запись на экокурс'), 0)
        return { ...prog, courseXpPaid: [...prog.courseXpPaid, id], xp: prog.xp + 28 }
      })

      return [...prev, id]
    })
  }

  const onQuizPick = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    if (i !== quiz.correct) return
    const today = isoDay()
    setProgress((p) => {
      if (p.quizPaidDay === today) return p
      window.setTimeout(() => pushToast('+36 XP · Ежедневная викторина'), 0)
      return { ...p, quizPaidDay: today, xp: p.xp + 36 }
    })
  }

  const sendChat = (e: FormEvent) => {
    e.preventDefault()
    const t = chatDraft.trim()
    if (!t) return
    const author = nickname.trim() || 'Волонтёр'
    setChat((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        author,
        text: t,
        at: new Date().toISOString(),
      },
    ])
    setChatDraft('')
  }

  const dailyLabel = useMemo(() => {
    return new Intl.DateTimeFormat('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date())
  }, [])

  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  )

  return (
    <div className="app">
      <div className="toast-layer" role="status" aria-live="polite">
        {toast && <div className="toast-floating">{toast}</div>}
      </div>

      <header className={`navbar${navScrolled ? ' navbar--scrolled' : ''}`}>
        <div className={`navbar__shell${navMobileOpen ? ' navbar__shell--menu-open' : ''}`}>
          <div className="navbar__row">
            <button
              type="button"
              className={`navbar__menu-btn${navMobileOpen ? ' navbar__menu-btn--open' : ''}`}
              aria-expanded={navMobileOpen}
              aria-controls="navbar-mobile-panel"
              onClick={() => setNavMobileOpen((o) => !o)}
            >
              <span className="navbar__menu-icon" aria-hidden="true" />
              <span className="visually-hidden">Меню разделов</span>
            </button>

            <a
              href="#top"
              className="navbar__brand logo"
              onClick={(e) => {
                e.preventDefault()
                scrollToTop()
              }}
            >
              <span className="logo__mark">S</span>
              <span className="logo__word">
                aq<span className="logo__accent">ta</span>
              </span>
              <span className="logo__tag">Астана</span>
            </a>

            <nav className="navbar__desktop" aria-label="Разделы">
              <div className="navbar__links-pill" role="presentation">
                {NAV_SECTIONS.map(({ id, label }) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className={`navbar__link${activeNavId === id ? ' navbar__link--active' : ''}`}
                    onClick={(e) => {
                      e.preventDefault()
                      scrollTo(id)
                    }}
                    aria-current={activeNavId === id ? 'location' : undefined}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </nav>

            <div className="navbar__xp" title="Ваш прогресс волонтёра">
              <div className="xp-lines">
                <span className="xp-lines__lvl">Ур. {band.level}</span>
                <span className="xp-lines__rank">{band.title}</span>
              </div>
              <div className="xp-bar" aria-hidden="true">
                <span className="xp-bar__fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="xp-total">{progress.xp} XP</span>
            </div>
          </div>

          <div
            id="navbar-mobile-panel"
            className={`navbar__mobile${navMobileOpen ? ' navbar__mobile--open' : ''}`}
            hidden={!navMobileOpen}
          >
            <div className="navbar__mobile-inner">
              {NAV_SECTIONS.map(({ id, label }) => (
                <a
                  key={`m-${id}`}
                  href={`#${id}`}
                  className={`navbar__mobile-link${activeNavId === id ? ' navbar__mobile-link--active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    scrollTo(id)
                  }}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {navMobileOpen ? (
          <button
            type="button"
            className="navbar__backdrop"
            aria-label="Закрыть меню"
            tabIndex={-1}
            onClick={() => setNavMobileOpen(false)}
          />
        ) : null}
      </header>

      <main className="main" id="top">
        <section className="section hero reveal" data-reveal aria-labelledby="hero-title">
          <div className="hero-wrap">
            <div className="hero__grid hero__grid--wide">
              <div className="hero__copy">
                <p className="hero__badge">Вода · Астана · волонтёры</p>
                <h1 id="hero-title" className="hero__h1">
                  Saqta — сохраняем источники и берег Есиля от мусора и микропластика
                </h1>
                <p className="hero__lead">
                  Принимайте городские ивенты в ленте, копите XP как активист столицы, общайтесь с
                  волонтёрам в живом канале и ведите друзья к совместным выходам.
                </p>
                <div className="hero__actions">
                  <button type="button" className="btn btn--primary btn--lg" onClick={() => scrollTo('feed')}>
                    Открыть ленту Астаны
                  </button>
                  <button type="button" className="btn btn--ghost btn--lg" onClick={() => scrollTo('chat')}>
                    Чат активистов
                  </button>
                </div>
                <dl className="hero__stats">
                  <div>
                    <dt>Ваш XP</dt>
                    <dd>{progress.xp}</dd>
                  </div>
                  <div>
                    <dt>Уровень</dt>
                    <dd>{band.level}</dd>
                  </div>
                  <div>
                    <dt>Принято в ленте</dt>
                    <dd>{progress.feedTaken.length}</dd>
                  </div>
                </dl>
              </div>

              <aside className="hero__aside hero__aside--lift">
                <h3>Как растёт опыт</h3>
                <ul className="hero__checks">
                  <li>
                    Принять ивент в ленте <strong>до +70 XP</strong>
                  </li>
                  <li>
                    Правильный ответ викторины <strong>до +36 XP / день</strong>
                  </li>
                  <li>
                    Первое зачисление на курс · сигнал роботу · друзья и свои события — доп. XP
                  </li>
                </ul>
                <button type="button" className="btn btn--primary btn--block" onClick={() => scrollTo('feed')}>
                  Искать ближайшую задачу
                </button>
              </aside>
            </div>
          </div>
        </section>

        <section className="section section--feed surface-band-strong reveal reveal--delay-sm" data-reveal id="feed">
          <div className="section-head">
            <div>
              <h2 className="section__title section__title--xl">Лента · Астана</h2>
              <p className="section__subtitle section__subtitle--wide">
                Реальные форматы задач под город: Есиль и прибрежные зоны озёр, технические русла у
                жилых кварталов. Нажимайте «Принимаю участие» — задача сохранится, XP начислится один
                раз.
              </p>
            </div>
            <button type="button" className="btn btn--ghost" onClick={() => scrollTo('chat')}>
              Согласовать выход в чате →
            </button>
          </div>

          <div className="feed">
            {ASTANA_FEED.map((item) => {
              const taken = progress.feedTaken.includes(item.id)
              return (
                <article key={item.id} className={`feed-card ${taken ? 'feed-card--done' : ''}`}>
                  <div className="feed-card__head">
                    <span className="tag">{FEED_KIND_LABEL[item.kind]}</span>
                    <span className="feed-card__xp">+{item.xp} XP</span>
                  </div>
                  <h3 className="feed-card__title">{item.title}</h3>
                  <p className="feed-card__desc">{item.blurb}</p>
                  <div className="feed-card__meta">
                    <span>📍 {item.place}</span>
                    <span>🗓️ {item.when}</span>
                  </div>
                  <div className="feed-card__row">
                    {taken ? (
                      <span className="chip chip--done">Вы в деле ✓</span>
                    ) : (
                      <button type="button" className="btn btn--primary" onClick={() => takeFeed(item)}>
                        Принимаю участие
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <div className="surface-band reveal reveal--delay-md" data-reveal id="mission">
          <section className="section section--compact">
            <h2 className="section__title section__title--xl">Проблема в масштабе города</h2>
            <p className="section__subtitle section__subtitle--wide">
              Загрязнённые участки Есиля, придонные затоны озёр Нура и других искусственных водоёмов
              становятся накопителями упаковки. Микропластик уходит в дождевые каналы там, где синтетика
              скапливается у понтонов или у душевых зон активного отдыха.
            </p>
            <div className="cards cards--3">
              <article className="card card--elevated">
                <h3>Пластик у берега</h3>
                <p>Ветер разносит упаковку от набережных зон даже там, где казалось бы порядок.</p>
              </article>
              <article className="card card--elevated">
                <h3>Сток после грозы</h3>
                <p>Разовые ливни смешивают крупное и части синтетики в одну струю навстречу руслу.</p>
              </article>
              <article className="card card--elevated">
                <h3>Сеть важнее усилий одного</h3>
                <p>Синхронные выходы, чат активистов и роботические отметки экономят дорог до источников.</p>
              </article>
            </div>
          </section>
        </div>

        <section className="section reveal" data-reveal id="chat">
          <div className="section-head section-head--chat">
            <div>
              <h2 className="section__title section__title--xl">Общий чат волонтёров · Астана</h2>
              <p className="section__subtitle section__subtitle--wide">
                Демонстрационный режим без серверов — сообщения и имя сохраняются только в браузере. В
                продукте сюда придёт настоящий канал активистов.
              </p>
            </div>
          </div>

          <div className="chat-panel">
            <div className="chat-panel__rail">
              <div className="chat-nick glass">
                <label htmlFor="nick">Отображать как</label>
                <input
                  id="nick"
                  className="input input--dense"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ваш позывной"
                  maxLength={40}
                />
              </div>
              <div className="rail-card glass">
                <h3>Компаньоны</h3>
                <p className="rail-hint">Кого зовёте на линию</p>
                {friends.length === 0 ? (
                  <p className="rail-empty">Добавьте друзей ниже — их имена можно теговать в тексте чата.</p>
                ) : (
                  <ul className="rail-list">
                    {friends.map((f) => (
                      <li key={f.id}>{f.name}</li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="button" className="btn btn--ghost btn--block" onClick={() => scrollTo('friends')}>
                Расширить список друзей
              </button>
            </div>

            <div className="chat-stream glass">
              <div className="chat-stream__head">
                <span>Сообщества Saqta</span>
                <span className="dot-live">онлайн-концепция</span>
              </div>
              <div className="chat-messages" role="log" aria-live="polite">
                {chat.map((m) => (
                  <div
                    key={m.id}
                    className={`bubble ${m.system ? 'bubble--system' : ''} ${
                      m.author === nickname.trim() ? 'bubble--me' : ''
                    }`}
                  >
                    <div className="bubble__who">
                      {m.system ? '🛰️ модератор' : m.author}
                      <span className="bubble__when">{timeFmt.format(new Date(m.at))}</span>
                    </div>
                    <div className="bubble__txt">{m.text}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <form className="chat-form" onSubmit={sendChat}>
                <textarea
                  className="textarea textarea--chat"
                  placeholder="Например: нужны два человека к Нуре после 17:30"
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  rows={2}
                  maxLength={800}
                  aria-label="Сообщение волонтёрам"
                />
                <button type="submit" className="btn btn--primary chat-send">
                  Отправить
                </button>
              </form>
            </div>
          </div>
        </section>

        <div className="surface-band reveal reveal--delay-sm" data-reveal>
          <section className="section" id="events">
            <h2 className="section__title section__title--xl">Личные экособытия</h2>
            <p className="section__subtitle section__subtitle--wide">
              Ведите собственный план — данные остаются у вас в браузере. Каждое новое событие даёт +
              мотивационный XP.
            </p>
            <form className="form form--panels" onSubmit={addEvent}>
              <div className="glass form-grid">
                <div className="field">
                  <label htmlFor="evt-title">Название</label>
                  <input
                    id="evt-title"
                    className="input"
                    value={evtTitle}
                    onChange={(e) => setEvtTitle(e.target.value)}
                    placeholder="Например: Уборка у родника возле озера Жасыл Арна"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="evt-date">Дата и время</label>
                  <input
                    id="evt-date"
                    className="input"
                    value={evtDate}
                    onChange={(e) => setEvtDate(e.target.value)}
                    placeholder="26 мая, 11:00"
                    required
                  />
                </div>
              </div>
              <div className="glass form-grid-full">
                <div className="field">
                  <label htmlFor="evt-note">Заметка (необязательно)</label>
                  <textarea
                    id="evt-note"
                    className="textarea"
                    style={{ minHeight: 78 }}
                    value={evtNote}
                    onChange={(e) => setEvtNote(e.target.value)}
                    placeholder="Формат сбора, что взять с собой"
                  />
                </div>
                <button type="submit" className="btn btn--primary btn--lg">
                  Добавить событие
                </button>
              </div>
            </form>
            {events.length > 0 && (
              <ul className="list list--elevated">
                {events.map((ev) => (
                  <li key={ev.id} className="list__item glass">
                    <div>
                      <strong>{ev.title}</strong>
                      <div className="list__meta">{ev.date}</div>
                      {ev.note && <div className="list__meta">{ev.note}</div>}
                    </div>
                    <button
                      type="button"
                      className="list__del"
                      aria-label="Удалить событие"
                      onClick={() => setEvents((p) => p.filter((x) => x.id !== ev.id))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="section reveal reveal--delay-md" data-reveal id="friends">
          <h2 className="section__title section__title--xl">Друзья Saqta</h2>
          <p className="section__subtitle section__subtitle--wide">
            Соберите свою микросеть: используйте имена в чате, сверяйтесь по берегу и делитесь XP
            прогрессом на словах.
          </p>
          <form className="form form--panels" onSubmit={addFriend}>
            <div className="glass form-grid">
              <div className="field">
                <label htmlFor="fr-name">Имя</label>
                <input
                  id="fr-name"
                  className="input"
                  value={frName}
                  onChange={(e) => setFrName(e.target.value)}
                  placeholder="Айдана"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="fr-email">Почта (необязательно)</label>
                <input
                  id="fr-email"
                  type="email"
                  className="input"
                  value={frEmail}
                  onChange={(e) => setFrEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <button type="submit" className="btn btn--primary btn--lg">
              Добавить друга
            </button>
          </form>
          {friends.length > 0 && (
            <ul className="list list--elevated">
              {friends.map((f) => (
                <li key={f.id} className="list__item glass">
                  <div>
                    <strong>{f.name}</strong>
                    {f.email && <div className="list__meta">{f.email}</div>}
                  </div>
                  <button
                    type="button"
                    className="list__del"
                    aria-label="Удалить из списка"
                    onClick={() => setFriends((p) => p.filter((x) => x.id !== f.id))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="surface-band reveal" data-reveal>
          <section className="section" id="robot">
            <h2 className="section__title section__title--xl">Запрос к роботу-патрулю</h2>
            <p className="section__subtitle section__subtitle--wide">
              Поддержите технологический слой: первый робот-сигнал в день добавляет дополнительный XP.
            </p>
            <form className="form form--wide form--panels" onSubmit={sendRobot}>
              <div className="glass form-grid-full">
                <div className="field">
                  <label htmlFor="robot-msg">Что нужно проверить</label>
                  <textarea
                    id="robot-msg"
                    className="textarea"
                    value={robotPrompt}
                    onChange={(e) => setRobotPrompt(e.target.value)}
                    placeholder="Подъезд понтона севернее Велопарка — дрейф упаковок после последнего ветерка"
                    required
                  />
                </div>
                <button type="submit" className="btn btn--primary btn--lg">
                  Вызвать робота
                </button>
              </div>
            </form>
            {robotStatus && <p className="toast">{robotStatus}</p>}
          </section>
        </div>

        <section className="section reveal reveal--delay-sm" data-reveal id="courses">
          <h2 className="section__title section__title--xl">Экокурсы</h2>
          <p className="section__subtitle section__subtitle--wide">
            Продвиньтесь через короткие треки. За первое зачисление на каждый курс вы получаете XP.
          </p>
          <div className="cards cards--3">
            {ECO_COURSES.map((c) => (
              <article key={c.id} className="card card--course">
                <h3>{c.title}</h3>
                <p className="card__span">{c.duration}</p>
                <p>{c.blurb}</p>
                <div className="card__foot">
                  <button
                    type="button"
                    className={enrolled.includes(c.id) ? 'btn btn--ghost btn--stretch' : 'btn btn--primary btn--stretch'}
                    onClick={() => toggleCourse(c.id)}
                  >
                    {enrolled.includes(c.id) ? 'Отписаться' : 'Записаться (+XP за первое зачисление)'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="surface-band reveal reveal--delay-md" data-reveal>
          <section className="section" id="quiz">
            <h2 className="section__title section__title--xl">Ежедневная викторина</h2>
            <p className="section__subtitle section__subtitle--wide">
              {dailyLabel.charAt(0).toUpperCase() + dailyLabel.slice(1)} · корректный ответ платит один
              бонус в сутки
            </p>
            <div className="quiz-card quiz-card--xl">
              <p className="quiz-q">{quiz.question}</p>
              <div className="quiz-options" role="radiogroup" aria-labelledby="quiz-group">
                <span id="quiz-group" className="visually-hidden">
                  Выберите один ответ
                </span>
                {quiz.options.map((opt, i) => {
                  let cls = 'quiz-option'
                  if (picked !== null) {
                    if (i === quiz.correct) cls += ' quiz-option--correct'
                    else if (i === picked && picked !== quiz.correct) cls += ' quiz-option--wrong'
                  }
                  return (
                    <button key={opt} type="button" className={cls} disabled={picked !== null} onClick={() => onQuizPick(i)}>
                      {opt}
                    </button>
                  )
                })}
              </div>
              {picked !== null && (
                <p className="quiz-foot">
                  <strong>Пояснение: </strong>
                  {quiz.explain}
                </p>
              )}
            </div>
          </section>
        </div>

        <section className="section reveal" data-reveal id="team">
          <h2 className="section__title section__title--xl">Наша команда — IBeasts</h2>
          <p className="section__subtitle section__subtitle--wide">
            Мультидисциплинарный костяк роботики, наблюдений воды и волонтёрской поддержки городов.
          </p>
          <div className="team team--large">
            <article className="team-card team-card--halo glass">
              Полевые наблюдатели фиксируют поток упаковки и ставят задачу патрулю — вы видите результат в
              ленте событий.
            </article>
            <article className="team-card team-card--halo glass">
              Роботы и интерфейс Saqta соединяют сигнал от активистов, карту Есиля и выездные команды без
              лишней бюрократии.
            </article>
            <article className="team-card team-card--halo glass">
              Программы обучения и XP помогают вовлекать город: от бытового микропластика до патрульных циклов у
              воды.
            </article>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          <strong>Saqta</strong> · <strong>IBeasts</strong> · Астана © {new Date().getFullYear()} · Прототип интерфейса
          сохраняет данные локально до подключения бэкенда
        </p>
      </footer>
    </div>
  )
}
