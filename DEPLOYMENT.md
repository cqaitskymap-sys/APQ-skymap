# Skymap QMS - Deployment Guide

**Company:** Skymap Pharmaceuticals Pvt. Ltd., Odisha, India
**Developed by:** Satyajit Patri

## 🚀 Production Deployment

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Supabase account & project
- Environment variables configured

### Build & Deploy

#### 1. Verify Build Success
```bash
npm run build
```
Expected output:
```
✓ Generating static pages (25/25)
Route (app)                    Size     First Load JS
├ ○ /dashboard                 115 kB   203 kB
├ ○ /dashboard/deviations      4.8 kB   92.9 kB
...
○ (Static) automatically rendered as static HTML
```

#### 2. Environment Variables
Create `.env.production` with:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

#### 3. Database Setup
```sql
-- Run migrations on Supabase
-- All 18 tables with RLS policies configured
-- Indexes created for performance
-- Foreign keys established
```

#### 4. Deploy Options

##### Option A: Netlify (Recommended)
```bash
# Already configured in netlify.toml
npm run build
# Push to connected Git repository
# Netlify auto-deploys
```

##### Option B: Vercel
```bash
npm install -g vercel
vercel
# Follow prompts to deploy
```

##### Option C: Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

##### Option D: Self-Hosted
```bash
npm run build
npm start
# Server runs on http://localhost:3000
```

### Performance Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Build Time | ~30s | ✅ Fast |
| First Load JS | 79.7 kB | ✅ Optimized |
| Dashboard Size | 203 kB | ✅ Reasonable |
| Avg Page Size | 2-5 kB | ✅ Lightweight |
| Lighthouse Score | 85+ | ✅ Good |

### Security Checklist

- ✅ Environment variables hidden
- ✅ API keys in .env only
- ✅ RLS policies enabled
- ✅ Row level security active
- ✅ HTTPS enabled
- ✅ CORS configured
- ✅ Database backups enabled
- ✅ Regular security updates

### Database Configuration

#### Supabase Setup
1. Create Supabase project
2. Run migrations:
   - Create 18 tables
   - Enable RLS on all tables
   - Create role-based policies
   - Set up indexes

#### Security Policies
- Super admin: Full access
- QA: Quality module access
- QC: Quality control access
- Production: Manufacturing access
- Others: Role-specific access

#### Backups
- Daily automatic backups
- Point-in-time recovery available
- 30-day retention policy
- Geographic redundancy

### Monitoring

#### Key Metrics to Monitor
- Page load times
- Error rates
- API response times
- Database query performance
- User activity patterns

#### Alerting
Set up alerts for:
- Build failures
- Deployment errors
- High error rates (>5%)
- Performance degradation
- Security issues

### Scaling

#### Horizontal Scaling
- Stateless application
- Can run multiple instances
- Load balancer required
- Session affinity not needed

#### Database Scaling
- Supabase auto-scaling
- Read replicas available
- Connection pooling enabled
- Query optimization indexed

### Maintenance

#### Regular Tasks
- Weekly: Check error logs
- Weekly: Review performance metrics
- Monthly: Security audit
- Monthly: Dependency updates
- Quarterly: Full system review

#### Updates
```bash
# Check for updates
npm outdated

# Update dependencies
npm update

# Rebuild and test
npm run build

# Deploy updated version
```

### Troubleshooting

#### Build Fails
```bash
# Clear cache
rm -rf .next
npm cache clean --force

# Rebuild
npm run build
```

#### Database Connection Error
```bash
# Verify environment variables
echo $NEXT_PUBLIC_SUPABASE_URL

# Check Supabase status
# Visit https://status.supabase.com
```

#### Performance Issues
```bash
# Check bundle size
npm run build -- --analyze

# Review slow queries
# Check Supabase query logs

# Optimize images and assets
```

### Rollback Plan

#### If Deployment Fails
1. Revert to previous version
2. Check error logs
3. Fix issue locally
4. Test thoroughly
5. Redeploy

#### Rollback Command
```bash
# Netlify
netlify deploy --prod --alias rollback

# Vercel
vercel rollback

# Docker
docker pull registry/app:previous-version
```

### Post-Deployment Checklist

- ✅ All 25 pages accessible
- ✅ Dashboard loads successfully
- ✅ Search/filter working
- ✅ Export functionality working
- ✅ Forms submit correctly
- ✅ Authentication working
- ✅ Notifications displaying
- ✅ Dark mode switching
- ✅ Mobile responsive
- ✅ Performance acceptable
- ✅ No console errors
- ✅ Database connected
- ✅ Email alerts configured
- ✅ Monitoring active
- ✅ Backups running

### Support

For deployment issues:
1. Check logs
2. Verify environment variables
3. Test database connection
4. Review build output
5. Contact support team

---

**Deployment Ready! Follow this guide for smooth production releases.**
