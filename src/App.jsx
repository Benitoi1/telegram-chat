import { useState } from 'react'

const API_URL = 'https://4100.api.green-api.com'

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

  const base = `${API_URL}/waInstance${idInstance}`

  async function handleLogin() {
    setError('')
    try {
      const res = await fetch(`${base}/getStateInstance/${token}`)
      const data = await res.json()
      console.log(data)
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
    const body = value.startsWith('@')
      ? { username: value }
      : { phoneNumber: Number(value.replace(/\D/g, '')) }
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
        setChats([
          ...chats,
          { chatId: data.chatId, title: data.username || value, messages: [] },
        ])
      }
      setActiveId(data.chatId)
      setContact('')
    } catch {
      setChatError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }


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
      <div style={{ flex: 1, padding: 12 }}>
        {active ? `Чат с ${active.title}.`
          : 'Выберите чат или создайте новый'}
      </div>
    </div>
  )
}