import { useState, useEffect } from 'react'

export default function App() {
  const [idInstance, setId] = useState(localStorage.getItem('idInstance') || '')
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [error, setError] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)

  const [chats, setChats] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [contact, setContact] = useState('')
  const [chatError, setChatError] = useState('')
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [sendError, setSendError] = useState('')

  const apiUrl = `https://${idInstance.trim().slice(0, 4)}.api.green-api.com`
  const base = `${apiUrl}/waInstance${idInstance}`

  async function handleLogin() {
    setError('')
    try {
      const res = await fetch(`${base}/getStateInstance/${token}`)
      const data = await res.json()
      if (data.stateInstance === 'authorized') {
        localStorage.setItem('idInstance', idInstance)
        localStorage.setItem('token', token)
        setLoggedIn(true)
      } else setError('Инстанс не авторизован или данные неверны')
    } catch (e) {
      setError('Не удалось подключиться к API')
    }
  }

  async function createChat() {
    setChatError('')
    if (!idInstance || !token) {
      setChatError('Введите idInstance и токен')
      setLoggedIn(false)
      return
    }
    const value = contact.trim()
    if (!value) return
    const digits = value.replace(/\D/g, '')
    if (!value.startsWith('@') && digits.length < 8) {
      setChatError('Введите номер цифрами (например 79876543210) или @username')
      return
    }
    const body = value.startsWith('@')
      ? { username: value }
      : { phoneNumber: Number(digits) }
    setLoading(true)
    try {
      const res = await fetch(`${base}/checkAccount/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || data.status === false) {
        setChatError('Не удалось проверить контакт, попробуйте позже')
        return
      }
      if (!data.exist) {
        setChatError('Аккаунт не найден или номер скрыт настройками приватности')
        return
      }
      if (!chats.some(c => c.chatId === data.chatId)) {
        setChats(prev =>
          prev.some(c => c.chatId === data.chatId)
            ? prev
            : [...prev, { chatId: data.chatId, title: data.username || value, messages: [] }]
        )
      }
      setActiveId(data.chatId)
      setContact('')
    } catch {
      setChatError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage() {
    const message = text.trim()
    if (!message || !activeId) return
    setSendError('')
    try {
      const res = await fetch(`${base}/sendMessage/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: activeId, message }),
      })
      const data = await res.json()
      if (!res.ok || data.status === false) {
        setSendError('Не удалось отправить сообщение')
        return
      }
      setChats(prev =>
        prev.map(c =>
          c.chatId === activeId
            ? { ...c, messages: [...c.messages, { id: data.idMessage || Date.now(), text: message, from: 'me' }] }
            : c
        )
      )
      setText('')
    } catch {
      setSendError('Ошибка сети')
    }
  }

  useEffect(() => {
    if (!loggedIn) return
    let stopped = false

    async function poll() {
      while (!stopped) {
        try {
          const res = await fetch(`${base}/receiveNotification/${token}?receiveTimeout=5`)
          const raw = await res.text()
          if (!res.ok) {
            await new Promise(r => setTimeout(r, 3000))
            continue
          }
          const data = raw ? JSON.parse(raw) : null
          if (!data) continue

          const body = data.body || data

          if (
            body.typeWebhook === 'incomingMessageReceived' &&
            body.messageData?.typeMessage === 'textMessage'
          ) {
            const chatId = body.senderData.chatId
            const title = body.senderData.chatName || body.senderData.senderName || chatId
            const msg = {
              id: body.idMessage,
              text: body.messageData.textMessageData.textMessage,
              from: 'them',
            }
            setChats(prev => {
              const chat = prev.find(c => c.chatId === chatId)
              if (!chat) return [...prev, { chatId, title, messages: [msg] }]
              if (chat.messages.some(m => m.id === msg.id)) return prev
              return prev.map(c =>
                c.chatId === chatId ? { ...c, messages: [...c.messages, msg] } : c
              )
            })
          }

          await fetch(`${base}/deleteNotification/${token}/${data.receiptId}`, {
            method: 'DELETE',
          })
        } catch (e) {
          await new Promise(r => setTimeout(r, 3000))
        }
      }
    }

    poll()
    return () => { stopped = true }
  }, [loggedIn])


  if (!loggedIn) {
    return (
      <div className="login">
        <h2>Вход</h2>
        <input className="field" name="idInstance" autoComplete="off"
          inputMode="numeric" placeholder="idInstance" value={idInstance}
          onChange={e => setId(e.target.value.trim())} />
        <input className="field" name="apiTokenInstance" type="password"
          autoComplete="new-password" placeholder="apiTokenInstance" value={token}
          onChange={e => setToken(e.target.value.trim())} />
        <button className="btn" onClick={handleLogin}>Войти</button>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  const active = chats.find(c => c.chatId === activeId)

  return (
    <div className="app">
      <div className="sidebar">
        <div className="new-chat">
          <input className="field" placeholder="Номер или @username"
            value={contact} onChange={e => setContact(e.target.value)} />
          <button className="btn" onClick={createChat} disabled={loading}>+</button>
        </div>
        {chatError && <p className="error">{chatError}</p>}
        {chats.map(c => {
          const last = c.messages[c.messages.length - 1]
          return (
            <div key={c.chatId} onClick={() => setActiveId(c.chatId)}
              className={`chat-item ${c.chatId === activeId ? 'active' : ''}`}>
              <div className="avatar">{c.title.replace('@', '').charAt(0).toUpperCase()}</div>
              <div className="chat-info">
                <div className="chat-title">{c.title}</div>
                <div className="chat-preview">{last ? last.text : 'Нет сообщений'}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="main">
        {!active ? (
          <div className="placeholder">Выберите чат или создайте новый</div>
        ) : (
          <>
            <div className="header">
              <div className="avatar">{active.title.replace('@', '').charAt(0).toUpperCase()}</div>
              <div className="chat-title">{active.title}</div>
            </div>
            <div className="messages">
              {active.messages.map(m => (
                <div key={m.id} className={`bubble ${m.from === 'me' ? 'me' : 'them'}`}>
                  {m.text}
                </div>
              ))}
            </div>
            {sendError && <p className="error">{sendError}</p>}
            <div className="composer">
              <input className="field" placeholder="Сообщение" value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()} />
              <button className="send" onClick={sendMessage}>➤</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}