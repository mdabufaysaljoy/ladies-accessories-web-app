import { Hero } from '@/components/home/Hero'
import { TrustStrip } from '@/components/home/TrustStrip'
import { CategoryShowcase } from '@/components/home/CategoryShowcase'
import { FeaturedTabs } from '@/components/home/FeaturedTabs'
import { PromoBanner } from '@/components/home/PromoBanner'
import { RoutineSteps } from '@/components/home/RoutineSteps'
import { StoryStrip } from '@/components/home/StoryStrip'
import { Testimonials } from '@/components/home/Testimonials'
import { usePageMeta } from '@/components/common/PageShell'

export default function Home() {
  usePageMeta(
    null,
    'Goods by Sadia — curated hijabs, hair care, skincare and cosmetics. Cash on delivery and secure SSLCommerz payment across Bangladesh.',
  )

  return (
    <>
      <Hero />
      <TrustStrip />
      <CategoryShowcase />
      <PromoBanner />
      <FeaturedTabs />
      <RoutineSteps />
      <Testimonials />
      <StoryStrip />
    </>
  )
}
