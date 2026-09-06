import { addComponent, createResolver, defineNuxtModule } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'

export interface VueFlowUploadNuxtModuleOptions {
  /** Prefix applied to the globally registered component names. */
  prefix: string
}

const module: NuxtModule<VueFlowUploadNuxtModuleOptions> = defineNuxtModule({
  meta: {
    name: 'vue-flow-upload',
    configKey: 'vueFlowUpload',
    compatibility: { nuxt: '^3.0.0 || ^4.0.0' },
  },
  defaults: {
    prefix: '',
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)
    const prefix = options.prefix ?? ''

    // These components import preview and cropper integrations that use browser APIs.
    for (const [name, exportName] of [
      ['FlowUpload', 'FlowUpload'],
      ['AvatarUpload', 'AvatarUpload'],
    ] as const) {
      addComponent({
        name: `${prefix}${name}`,
        filePath: resolver.resolve('./index'),
        export: exportName,
        mode: 'client',
      })
    }

    nuxt.options.css.push(resolver.resolve('./style.css'))
  },
})

export default module
