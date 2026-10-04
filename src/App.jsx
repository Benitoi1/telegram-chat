import { useState, useEffect } from 'react'

const API_URL = ''

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

  const base = `${API_URL}/waInstance${idInstance}`

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
      <div style={{ maxWidth: 320, margin: '80px auto' }}>
        <h2>Вход</h2>
        <input placeholder="idInstance" value={idInstance}
          onChange={e => setId(e.target.value)} />
        <input placeholder="apiTokenInstance" value={token}
          onChange={e => setToken(e.target.value)} />
        <button onClick={handleLogin}>Войти</button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    )
  }

  const active = chats.find(c => c.chatId === activeId)

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: 300, borderRight: '1px solid #ccc', padding: 12 }}>
        <input placeholder="Номер или @username" value={contact}
          onChange={e => setContact(e.target.value)} />
        <button onClick={createChat} disabled={loading}>Создать чат</button>
        {chatError && <p style={{ color: 'red' }}>{chatError}</p>}
        {chats.map(c => (
          <div key={c.chatId} onClick={() => setActiveId(c.chatId)}
            style={{
              padding: 8, cursor: 'pointer',
              background: c.chatId === activeId ? '#eee' : 'none'
            }}>
            {c.title}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!active ? (
          <div style={{ padding: 12 }}>Выберите чат или создайте новый</div>
        ) : (
          <>
            <div style={{ padding: 12, borderBottom: '1px solid #ccc' }}>
              {active.title}
            </div>
            <div style={{
              flex: 1, overflowY: 'auto', padding: 12,
              display: 'flex', flexDirection: 'column', gap: 6
            }}>
              {active.messages.map(m => (
                <div key={m.id} style={{
                  alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start',
                  background: m.from === 'me' ? '#2b6cff' : '#444',
                  color: '#fff', padding: '6px 10px', borderRadius: 12,
                  maxWidth: '70%'
                }}>
                  {m.text}
                </div>
              ))}
            </div>
            {sendError && <p style={{ color: 'red', margin: 8 }}>{sendError}</p>}
            <div style={{ display: 'flex', padding: 12, gap: 8 }}>
              <input style={{ flex: 1 }} placeholder="Сообщение" value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()} />
              <button onClick={sendMessage}>Отправить</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}