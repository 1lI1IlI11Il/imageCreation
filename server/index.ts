import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import settingsRouter from './routes/settings.ts'
import jobsRouter from './routes/jobs.ts'
import imagesRouter from './routes/images.ts'

const app = new Hono()
app.use('*', cors())
app.route('/api/settings', settingsRouter)
app.route('/api', jobsRouter)
app.route('/api', imagesRouter)
app.get('/', (c) => c.text('nano-batch running'))

serve({ fetch: app.fetch, port: 3001 }, (info) => {
  console.log(`nano-batch server -> http://localhost:${info.port}`)
})
