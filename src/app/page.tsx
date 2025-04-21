import Link from "next/link"
import {
  ArrowRight,
  Brain,
  FileText,
  Globe,
  Activity,
  Calendar,
  Pill,
  User,
  BookOpen,
  Video,
  Watch,
  BarChart2,
  Lock,
  Shield,
  Layers,
  TrendingUp,
  Layout,
  CheckSquare,
  MessageCircle,
  Highlighter,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const testimonial = [
  {
    quote:
      "This platform has transformed how I explain lab results to my patients. The AI explanations are accurate and easy to understand.",
    name: "Dr. Sarah Johnson",
    title: "Cardiologist",
  },
  {
    quote:
      "As someone with no medical background, understanding my test results was always challenging. MedInsight AI makes it simple and clear.",
    name: "Michael Chen",
    title: "Patient",
  },
  {
    quote:
      "The integration with our hospital's EHR system was seamless. Our staff saves hours every day with automated report analysis.",
    name: "Dr. Robert Williams",
    title: "Hospital Administrator",
  },
]

const pricing = [
  {
    title: "Basic",
    price: "$9.99",
    description: "Perfect for individual users",
    features: ["10 reports per month", "Basic report analysis", "Interactive Q&A", "Email support"],
    cta: "Get Started",
    popular: false,
  },
  {
    title: "Professional",
    price: "$29.99",
    description: "Ideal for healthcare professionals",
    features: [
      "50 reports per month",
      "Advanced report analysis",
      "All basic features",
      "Telehealth integration",
      "Priority support",
    ],
    cta: "Get Started",
    popular: true,
  },
  {
    title: "Enterprise",
    price: "Custom",
    description: "For healthcare organizations",
    features: [
      "Unlimited reports",
      "Full API access",
      "All professional features",
      "Custom integrations",
      "Dedicated account manager",
    ],
    cta: "Contact Sales",
    popular: false,
  },
]

const features = [
  {
    icon: MessageCircle,
    title: "Interactive Q&A",
    description: "Ask specific questions about your report and get context-aware answers.",
  },
  {
    icon: Highlighter,
    title: "Summarization & Highlighting",
    description: "Get concise summaries with key findings and abnormalities highlighted.",
  },
  {
    icon: Globe,
    title: "Translation Services",
    description: "Translate report explanations into multiple languages.",
  },
  {
    icon: Activity,
    title: "Symptom Checker",
    description: "AI-driven symptom assessment and preliminary health insights.",
  },
  {
    icon: Calendar,
    title: "Appointment Scheduling",
    description: "Schedule follow-up appointments with healthcare providers.",
  },
  {
    icon: Pill,
    title: "Medication Management",
    description: "Track medications, set reminders, and check for interactions.",
  },
  {
    icon: FileText,
    title: "E-Prescription Integration",
    description: "Manage electronic prescriptions generated from consultations.",
  },
  {
    icon: User,
    title: "Patient Portal",
    description: "Access your medical history, lab results, and personal information.",
  },
  {
    icon: BookOpen,
    title: "Personalized Education",
    description: "Receive relevant articles and resources based on your diagnoses.",
  },
  {
    icon: Video,
    title: "Telehealth Integration",
    description: "Connect with healthcare professionals through virtual consultations.",
  },
  {
    icon: Watch,
    title: "Wearables Integration",
    description: "Sync with health devices for real-time vitals and activity data.",
  },
  {
    icon: BarChart2,
    title: "Predictive Analytics",
    description: "Analyze trends to predict potential health issues.",
  },
]

const process = [
  {
    step: "1",
    title: "Upload Your Report",
    description: "Upload any medical report in various formats including PDF, images, or text.",
    icon: FileText,
  },
  {
    step: "2",
    title: "AI Analysis",
    description:
      "Our advanced AI models analyze the report, extracting key information and medical terminology.",
    icon: Brain,
  },
  {
    step: "3",
    title: "Get Insights",
    description:
      "Receive easy-to-understand summaries, explanations, and actionable insights about your health.",
    icon: Activity,
  },
]

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 border-b bg-white/80 backdrop-blur-md z-50 transition-all duration-300">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-teal-600" />
            <span className="text-xl font-bold">MedInsight AI</span>
          </div>
          <nav className="hidden md:flex gap-6">
            <Link href="#features" className="text-sm font-medium hover:underline underline-offset-4">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm font-medium hover:underline underline-offset-4">
              How It Works
            </Link>
            <Link href="#pricing" className="text-sm font-medium hover:underline underline-offset-4">
              Pricing
            </Link>
            <Link href="#about" className="text-sm font-medium hover:underline underline-offset-4">
              About
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium hover:underline underline-offset-4">
              Log In
            </Link>
            <Button>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="flex flex-col min-h-screen pt-16">
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-r from-teal-50 to-blue-50">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                    Understand Your Medical Reports with AI
                  </h1>
                  <p className="max-w-[600px] text-gray-500 md:text-xl">
                    Upload any medical report and get instant, easy-to-understand insights powered by advanced medical AI
                    models.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button size="lg" className="bg-teal-600 hover:bg-teal-700">
                    <Link href='/signup'>
                      Try For Free
                    </Link> <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline">
                    Watch Demo
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-teal-600" />
                  <span>HIPAA Compliant</span>
                  <span className="mx-2">•</span>
                  <Lock className="h-4 w-4 text-teal-600" />
                  <span>Secure Encryption</span>
                  <span className="mx-2">•</span>
                  <CheckSquare className="h-4 w-4 text-teal-600" />
                  <span>99.9% Accuracy</span>
                </div>
              </div>
              <div className="flex justify-center lg:justify-end">
                <div className="relative w-full max-w-[500px] h-[400px] rounded-lg overflow-hidden shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-blue-500/20 backdrop-blur-sm">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white rounded-lg shadow-lg p-6 w-[80%] max-w-[400px]">
                        <div className="flex items-center gap-2 mb-4">
                          <FileText className="h-5 w-5 text-teal-600" />
                          <h3 className="font-medium">Upload Your Medical Report</h3>
                        </div>
                        <div className="border-2 border-dashed border-gray-200 rounded-md p-8 flex flex-col items-center justify-center gap-2">
                          <FileText className="h-10 w-10 text-gray-400" />
                          <p className="text-sm text-gray-500">Drag & drop your file or click to browse</p>
                          <Button variant="outline" size="sm" className="mt-2">
                            Select File
                          </Button>
                        </div>
                        <div className="mt-4">
                          <Button className="w-full bg-teal-600 hover:bg-teal-700">Analyze Report</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Features Section */}
      <section id="features" className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-teal-100 px-3 py-1 text-sm text-teal-700">Features</div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Comprehensive Medical Report Analysis
              </h2>
              <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Our platform leverages advanced AI models like BioBERT, ClinicalBERT, BlueBERT, and GAMedX to provide
                accurate and comprehensive analysis of your medical reports.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 mt-12">
            {features.map((feature, index) => (
              <div key={index} className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm">
                <div className="rounded-full bg-teal-100 p-3">
                  <feature.icon className="h-6 w-6 text-teal-700" />
                </div>
                <h3 className="text-lg font-bold">{feature.title}</h3>
                <p className="text-sm text-gray-500">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="w-full py-12 md:py-24 lg:py-32 bg-gray-50">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-teal-100 px-3 py-1 text-sm text-teal-700">Process</div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">How It Works</h2>
              <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Our platform makes it easy to understand complex medical reports in just a few simple steps.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3 mt-12">
            {process.map((item, index) => (
              <div key={index} className="flex flex-col items-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-600 text-white">
                  <span className="text-2xl font-bold">{item.step}</span>
                </div>
                <item.icon className="h-8 w-8 text-teal-600" />
                <h3 className="text-xl font-bold">{item.title}</h3>
                <p className="text-center text-gray-500">{item.description}</p>
                {index < 2 && (
                  <div className="hidden md:block h-8">
                    <ArrowRight className="h-8 w-8 text-teal-600 rotate-0 md:rotate-90 lg:rotate-0" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Advanced Features Section */}
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
            <div className="space-y-4">
              <div className="inline-block rounded-lg bg-teal-100 px-3 py-1 text-sm text-teal-700">
                Advanced Technology
              </div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Powered by Medical AI</h2>
              <p className="text-gray-500 md:text-xl/relaxed">
                Our platform integrates specialized medical AI models trained on millions of medical documents to
                provide accurate and reliable insights.
              </p>
              <ul className="grid gap-2">
                {[
                  "BioBERT: Trained on PubMed for biomedical text mining",
                  "ClinicalBERT: Trained on clinical notes from MIMIC-III dataset",
                  "BlueBERT: Trained on a mix of general and biomedical text",
                  "GAMedX: Our proprietary medical language model",
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-teal-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Button className="bg-teal-600 hover:bg-teal-700">Learn More About Our Technology</Button>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <div className="relative w-full max-w-[500px] h-[400px] rounded-lg overflow-hidden shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-blue-500/20">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="grid grid-cols-2 gap-4 p-6">
                      {[
                        { icon: Layers, title: "Data Integration", color: "bg-green-100 text-green-700" },
                        { icon: TrendingUp, title: "Analytics Dashboard", color: "bg-purple-100 text-purple-700" },
                        { icon: Shield, title: "Enhanced Security", color: "bg-red-100 text-red-700" },
                        { icon: Layout, title: "User-Centric Features", color: "bg-orange-100 text-orange-700" },
                      ].map((item, index) => (
                        <div
                          key={index}
                          className="bg-white rounded-lg shadow-md p-4 flex flex-col items-center justify-center gap-2 text-center"
                        >
                          <div className={`rounded-full ${item.color} p-2`}>
                            <item.icon className="h-6 w-6" />
                          </div>
                          <h3 className="text-sm font-medium">{item.title}</h3>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="w-full py-12 md:py-24 lg:py-32 bg-gray-50">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-teal-100 px-3 py-1 text-sm text-teal-700">Pricing</div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Simple, Transparent Pricing
              </h2>
              <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Choose the plan that works best for you or your organization.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3 mt-12">
            {pricing.map((plan, index) => (
              <div
                key={index}
                className={`flex flex-col rounded-lg border ${plan.popular ? "border-teal-600 shadow-lg" : "border-gray-200"
                  } bg-white p-6`}
              >
                {plan.popular && (
                  <div className="absolute -mt-5 ml-6 rounded-full bg-teal-600 px-3 py-1 text-xs font-medium text-white">
                    Most Popular
                  </div>
                )}
                <div className="flex flex-col space-y-2">
                  <h3 className="text-xl font-bold">{plan.title}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.price !== "Custom" && <span className="text-gray-500">/month</span>}
                  </div>
                  <p className="text-sm text-gray-500">{plan.description}</p>
                </div>
                <ul className="my-6 space-y-2 flex-1">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-teal-600" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full ${plan.popular ? "bg-teal-600 hover:bg-teal-700" : "bg-gray-900 hover:bg-gray-800 cursor-pointer"
                    }`}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-teal-100 px-3 py-1 text-sm text-teal-700">Testimonials</div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">What Our Users Say</h2>
              <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Hear from healthcare professionals and patients who use our platform.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 mt-12">
            {testimonial.map((testimonial, index) => (
              <div key={index} className="flex flex-col space-y-4 rounded-lg border p-6 shadow-sm">
                <div className="flex-1">
                  <p className="text-gray-500 italic">{testimonial.quote}</p>
                </div>
                <div>
                  <p className="font-medium">{testimonial.name}</p>
                  <p className="text-sm text-gray-500">{testimonial.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-teal-600 text-white">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Ready to Understand Your Medical Reports?
              </h2>
              <p className="max-w-[900px] text-teal-100 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Join thousands of users who are taking control of their health with MedInsight AI.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Button size="lg" className="bg-white text-teal-600 hover:bg-teal-50 cursor-pointer">
                <Link href="/signup">Get Started for Free</Link>
              </Button>
              <Button size="lg" variant="outline" className="text-black border-white hover:bg-teal-500 cursor-pointer">
                Schedule a Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-12 md:py-24 border-t">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-4 lg:grid-cols-5">
            <div className="flex flex-col col-span-2 gap-2 lg:col-span-2">
              <div className="flex items-center gap-2">
                <Brain className="h-6 w-6 text-teal-600" />
                <span className="text-xl font-bold">MedInsight AI</span>
              </div>
              <p className="text-sm text-gray-500">
                Transforming complex medical reports into clear, actionable insights with advanced AI technology.
              </p>
              <div className="flex gap-4 mt-2">
                {["Twitter", "LinkedIn", "Facebook", "Instagram"].map((social) => (
                  <Link key={social} href="#" className="text-gray-500 hover:text-teal-600">
                    {social}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium">Product</h3>
              <nav className="flex flex-col gap-2">
                {["Features", "How It Works", "Pricing", "FAQ", "Support"].map((item) => (
                  <Link key={item} href="#" className="text-sm text-gray-500 hover:text-teal-600">
                    {item}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium">Company</h3>
              <nav className="flex flex-col gap-2">
                {["About Us", "Careers", "Blog", "Press", "Contact"].map((item) => (
                  <Link key={item} href="#" className="text-sm text-gray-500 hover:text-teal-600">
                    {item}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium">Legal</h3>
              <nav className="flex flex-col gap-2">
                {["Terms", "Privacy", "Cookies", "Licenses", "Settings"].map((item) => (
                  <Link key={item} href="#" className="text-sm text-gray-500 hover:text-teal-600">
                    {item}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
          <div className="mt-10 border-t pt-6 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-500">© {new Date().getFullYear()} MedInsight AI. All rights reserved.</p>
            <p className="text-sm text-gray-500 mt-2 md:mt-0">HIPAA Compliant | SOC 2 Certified | ISO 27001</p>
          </div>
        </div>
      </footer>
    </div>
  )
}