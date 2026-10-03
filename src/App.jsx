import { useState } from 'react'

const API_URL = 'https://green-api.com' //api изменен

export default function App() {
  const [idInstance, setId] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)

  async function handleLogin() {
    setError('')
    try {
      const res = await fetch(
        `${API_URL}/waInstance${idInstance}/getStateInstance/${token}`
      )
      const data = await res.json()
      console.log(data)
      if (data.stateInstance === 'authorized') setLoggedIn(true)
      else setError('Инстанс не авторизован или данные неверны')
    } catch (e) {
      setError('Не удалось подключиться к API')
    }
  }

  if (loggedIn) return <div>Вы вошли!</div>

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