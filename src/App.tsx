import { useCallback, useEffect, useMemo, useState } from 'react'

const LS_EVENTS = 'saqta-events'
const LS_FRIENDS = 'saqta-friends'
const LS_COURSES = 'saqta-courses-enrolled'

type EcoEvent = { id: string; title: string; date: string; note?: string }

type Friend = { id: string; name: string; email?: string }

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
  return (
    date.getFullYear() * 10_000 +
    (date.getMonth() + 1) * 100 +
    date.getDate()
  )
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

export function App() {
  const [events, setEvents] = useState<EcoEvent[]>(() => loadJSON(LS_EVENTS, []))
  const [friends, setFriends] = useState<Friend[]>(() => loadJSON(LS_FRIENDS, []))
  const [enrolled, setEnrolled] = useState<string[]>(() => loadJSON(LS_COURSES, []))

  const [evtTitle, setEvtTitle] = useState('')
  const [evtDate, setEvtDate] = useState('')
  const [evtNote, setEvtNote] = useState('')
  const [frName, setFrName] = useState('')
  const [frEmail, setFrEmail] = useState('')
  const [robotPrompt, setRobotPrompt] = useState('')
  const [robotStatus, setRobotStatus] = useState<string | null>(null)

  const [quizIndex, setQuizIndex] = useState(() => daySeed() % QUIZ_BANK.length)
  const [picked, setPicked] = useState<number | null>(null)
  const quiz = QUIZ_BANK[quizIndex]!

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
    const id = window.setInterval(() => {
      const next = daySeed() % QUIZ_BANK.length
      setQuizIndex((cur) => (cur !== next ? next : cur))
      setPicked(null)
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const addEvent = (e: React.FormEvent) => {
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
  }

  const addFriend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!frName.trim()) return
    setFriends((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: frName.trim(), email: frEmail.trim() || undefined },
    ])
    setFrName('')
    setFrEmail('')
  }

  const sendRobot = (e: React.FormEvent) => {
    e.preventDefault()
    if (!robotPrompt.trim()) return
    setRobotStatus('Запрос принят — робот поставлен в очередь на патруль источников.')
    setRobotPrompt('')
    window.setTimeout(() => setRobotStatus(null), 5000)
  }

  const toggleCourse = (id: string) => {
    setEnrolled((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const dailyLabel = useMemo(() => {
    return new Intl.DateTimeFormat('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date())
  }, [])

  return (
    <div className="app">
      <header className="header">
        <div className="header__inner">
          <a href="#" className="logo" onClick={(e) => e.preventDefault()}>
            Saq<span>ta</span>
          </a>
          <nav className="nav" aria-label="Разделы">
            <a href="#mission" onClick={() => scrollTo('mission')}>
              Цель
            </a>
            <a href="#events" onClick={() => scrollTo('events')}>
              События
            </a>
            <a href="#friends" onClick={() => scrollTo('friends')}>
              Друзья
            </a>
            <a href="#robot" onClick={() => scrollTo('robot')}>
              Робот
            </a>
            <a href="#courses" onClick={() => scrollTo('courses')}>
              Экокурсы
            </a>
            <a href="#quiz" onClick={() => scrollTo('quiz')}>
              Викторина
            </a>
            <a href="#team" onClick={() => scrollTo('team')}>
              Команда
            </a>
          </nav>
        </div>
      </header>

      <main className="main">
        <section className="section hero" aria-labelledby="hero-title">
          <div className="hero__grid">
            <div>
              <p className="hero__badge">Вода без мусора</p>
              <h1 id="hero-title" className="hero__h1">
                Saqta — бережём источники от мусора и микропластика
              </h1>
              <p className="hero__lead">
                Мы усиливаем локальную осведомлённость, координируем субботники у водоёмов,
                робот-патруль и обучение — чтобы пластик и мусор реже добирались до реки.
              </p>
              <div className="hero__actions">
                <button type="button" className="btn btn--primary" onClick={() => scrollTo('events')}>
                  Запланировать событие
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => scrollTo('courses')}>
                  Смотреть экокурсы
                </button>
              </div>
            </div>
            <aside className="hero__aside">
              <h3>На что мы смотрим</h3>
              <ul>
                <li>Сбор данных о свалках у русел и временных руслах</li>
                <li>Отслеживание синтетического стока с бытовых участков</li>
                <li>Быстрое создание задач патрулю и волонтёрам через робота</li>
              </ul>
            </aside>
          </div>
        </section>

        <div className="surface-band" id="mission">
          <section className="section section--compact">
            <h2 className="section__title">Проблема</h2>
            <p className="section__subtitle">
              Загрязнённые источники воды приносят вред всем ниже по течению: органика,
              упаковка и мельчайшие частицы пластика остаются в системе надолго.
            </p>
            <div className="cards cards--3">
              <article className="card">
                <h3>Пластик у берега</h3>
                <p>Бутылки и пакеты разлагаются на микрофрагменты и уходят в воду даже после дождя.</p>
              </article>
              <article className="card">
                <h3>Сток без фильтров</h3>
                <p>Волокна и краски из быта попадают в сток без видимых «выбросов», но суммарный эффект огромный.</p>
              </article>
              <article className="card">
                <h3>Нужна синхронность</h3>
                <p>Одному сложно удержать берег чистым: помогают заметные события, друзья в проекте и робот-сигналы.</p>
              </article>
            </div>
          </section>
        </div>

        <section className="section" id="events">
          <h2 className="section__title">Экособытия</h2>
          <p className="section__subtitle">
            Добавьте уборку, мониторинг или лекцию у воды — данные хранятся локально в браузере.
          </p>
          <form className="form" onSubmit={addEvent}>
            <div className="field">
              <label htmlFor="evt-title">Название</label>
              <input
                id="evt-title"
                className="input"
                value={evtTitle}
                onChange={(e) => setEvtTitle(e.target.value)}
                placeholder="Например: Уборка у родника «Каменка»"
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
                placeholder="24 мая, 11:00"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="evt-note">Заметка (необязательно)</label>
              <textarea
                id="evt-note"
                className="textarea"
                style={{ minHeight: 72 }}
                value={evtNote}
                onChange={(e) => setEvtNote(e.target.value)}
                placeholder="Сбор у моста, возьмём перчатки и мешки"
              />
            </div>
            <button type="submit" className="btn btn--primary">
              Добавить событие
            </button>
          </form>
          {events.length > 0 && (
            <ul className="list">
              {events.map((ev) => (
                <li key={ev.id} className="list__item">
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

        <div className="surface-band">
          <section className="section" id="friends">
            <h2 className="section__title">Друзья Saqta</h2>
            <p className="section__subtitle">
              Соберите список людей, с кем выходите на уборки и мониторинг — контакты не уходят на сервер.
            </p>
            <form className="form" onSubmit={addFriend}>
              <div className="field">
                <label htmlFor="fr-name">Имя</label>
                <input
                  id="fr-name"
                  className="input"
                  value={frName}
                  onChange={(e) => setFrName(e.target.value)}
                  placeholder="Айгерим"
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
              <button type="submit" className="btn btn--primary">
                Добавить друга
              </button>
            </form>
            {friends.length > 0 && (
              <ul className="list">
                {friends.map((f) => (
                  <li key={f.id} className="list__item">
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
        </div>

        <section className="section" id="robot">
          <h2 className="section__title">Запрос к роботу-патрулю</h2>
          <p className="section__subtitle">
            Отправьте короткий сигнал: координаты, фото описанием места или гипотезу о источнике загрязнения.
          </p>
          <form className="form form--wide" onSubmit={sendRobot}>
            <div className="field">
              <label htmlFor="robot-msg">Что нужно проверить</label>
              <textarea
                id="robot-msg"
                className="textarea"
                value={robotPrompt}
                onChange={(e) => setRobotPrompt(e.target.value)}
                placeholder="Ветка ручья у тропы X, на камнях синтетические волокна и плёнки"
                required
              />
            </div>
            <button type="submit" className="btn btn--primary">
              Вызвать робота
            </button>
          </form>
          {robotStatus && <p className="toast">{robotStatus}</p>}
        </section>

        <div className="surface-band">
          <section className="section" id="courses">
            <h2 className="section__title">Экокурсы</h2>
            <p className="section__subtitle">
              Короткие практические треки: от понимания пластика в воде до комьюнити-наблюдений.
            </p>
            <div className="cards cards--3">
              {ECO_COURSES.map((c) => (
                <article key={c.id} className="card">
                  <h3>{c.title}</h3>
                  <p style={{ marginBottom: '0.75rem', fontSize: '0.82rem', color: 'var(--accent)' }}>
                    {c.duration}
                  </p>
                  <p>{c.blurb}</p>
                  <div style={{ marginTop: '1rem' }}>
                    <button
                      type="button"
                      className={enrolled.includes(c.id) ? 'btn btn--ghost' : 'btn btn--primary'}
                      onClick={() => toggleCourse(c.id)}
                    >
                      {enrolled.includes(c.id) ? 'Отписаться' : 'Записаться'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="section" id="quiz">
          <h2 className="section__title">Ежедневная викторина</h2>
          <p className="section__subtitle">{dailyLabel.charAt(0).toUpperCase() + dailyLabel.slice(1)}</p>
          <div className="quiz-card">
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
                  <button
                    key={opt}
                    type="button"
                    className={cls}
                    disabled={picked !== null}
                    onClick={() => setPicked(i)}
                  >
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

        <div className="surface-band">
          <section className="section" id="team">
            <h2 className="section__title">Наша команда — IBeasts</h2>
            <p className="section__subtitle">
              Мультидисциплинарная команда: робототехника, полевые исследования и волонтёрская сеть —
              связка технологии и земных практик.
            </p>
            <div className="team">
              <article className="team-card">
                Полевые и наблюдатели водоёмов — ставят задачи патрулю, готовят субботники и связь с
                местными.
              </article>
              <article className="team-card">
                Роботы и интерфейс — быстрый приём ваших сообщений, постановка задач в очередь и карта активности у
                источников.
              </article>
              <article className="team-card">
                Образование — экокурсы и короткие лекции в поле, чтобы решения понимало больше людей по
                течению.
              </article>
              <article className="team-card">
                <strong>IBeasts</strong> координирует технологический и сообществный слои Saqta в одну
                устойчивую дорожную карту действий у воды.
              </article>
            </div>
          </section>
        </div>
      </main>

      <footer className="footer">
        <p>
          <strong>Saqta</strong> · команда <strong>IBeasts</strong> · минимализм экопривычки в действии у
          реки родника и ключей воды © {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  )
}
