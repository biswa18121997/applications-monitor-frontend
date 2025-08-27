import { useState } from 'react'

import Monitor from './components/Monitor'

function App() {
  const [count, setCount] = useState(0)

  return (
    <Monitor />
  )
}

export default App
