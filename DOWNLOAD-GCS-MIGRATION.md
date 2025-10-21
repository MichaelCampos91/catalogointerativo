# Migração de Download para Google Cloud Storage

## ✅ Implementação Concluída

A funcionalidade de download de imagens na página `/admin` foi refatorada para funcionar com Google Cloud Storage, mantendo o mesmo comportamento para o usuário.

## 🔄 Mudanças Realizadas

### **Arquivo Modificado: `/app/api/download/route.ts`**

#### **1. Adicionado Import do GCS**
```typescript
import { Storage } from '@google-cloud/storage'
```

#### **2. Adicionada Função getStorage()**
```typescript
function getStorage() {
  const isCloudRun = process.env.K_SERVICE || process.env.K_REVISION || process.env.PORT
  if (isCloudRun) {
    return new Storage({
      projectId: process.env.GCS_PROJECT_ID,
    })
  }
  if (process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY && process.env.GCS_PRIVATE_KEY.trim() !== '') {
    return new Storage({
      projectId: process.env.GCS_PROJECT_ID,
      credentials: {
        client_email: process.env.GCS_CLIENT_EMAIL,
        private_key: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
    })
  }
  return new Storage({
    projectId: process.env.GCS_PROJECT_ID,
  })
}
```

#### **3. Substituída Busca Local por Download do GCS**

**Antes (busca local):**
```typescript
// Buscar arquivos em /public/files
const filesDir = path.join(process.cwd(), "public", "files")
const foundFiles: string[] = []

function findFiles(dir: string) {
  const items = fs.readdirSync(dir, { withFileTypes: true })
  // ... copia arquivos locais
}
findFiles(filesDir)
```

**Depois (download do GCS):**
```typescript
// Buscar e baixar arquivos do GCS
const storage = getStorage()
const bucketName = process.env.GCS_BUCKET_NAME
const bucket = storage.bucket(bucketName)
const foundFiles: string[] = []

// Listar todos os arquivos do bucket com prefixo public/files/
const [files] = await bucket.getFiles({ prefix: 'public/files/' })

// Filtrar e baixar apenas os arquivos selecionados
for (const file of files) {
  const fileName = path.parse(file.name).name
  if (selectedImages.includes(fileName)) {
    const destPath = path.join(orderDir, path.basename(file.name))
    await file.download({ destination: destPath })
    foundFiles.push(destPath)
  }
}
```

## 🎯 Funcionalidades Mantidas

### **Comportamento Idêntico para o Usuário:**
- ✅ Botão "Baixar" na página admin
- ✅ Criação de ZIP com nome formatado: `YYYY-MM-DD_Cliente_Pedido.zip`
- ✅ Download automático do ZIP
- ✅ Limpeza de arquivos temporários
- ✅ Contagem de arquivos encontrados

### **Estrutura do ZIP:**
- ✅ Pasta temporária em `/public/temp/`
- ✅ Arquivos organizados por pedido
- ✅ Nomenclatura consistente
- ✅ Remoção automática após download

## 🔧 Como Funciona Agora

### **Fluxo de Download:**
1. **Recebe dados** do pedido (imagens selecionadas, cliente, etc.)
2. **Conecta ao GCS** usando Application Default Credentials
3. **Lista arquivos** do bucket com prefixo `public/files/`
4. **Filtra imagens** pelos códigos selecionados
5. **Baixa arquivos** do GCS para pasta temporária local
6. **Cria ZIP** da pasta temporária
7. **Remove pasta** temporária (mantém ZIP)
8. **Retorna caminho** do ZIP para download

### **Detecção de Ambiente:**
- **Cloud Run**: Usa Application Default Credentials automaticamente
- **Desenvolvimento**: Usa credenciais do `.env` se disponíveis
- **Fallback**: Usa ADC local se gcloud auth foi configurado

## 📋 Arquivos Não Modificados

- ✅ `app/admin/page.tsx` - sem alterações
- ✅ Lógica de ZIP e limpeza - mantida
- ✅ Estrutura de pastas temporárias - mantida
- ✅ Interface do usuário - idêntica

## 🧪 Testes Recomendados

### **1. Teste de Download Individual**
- Acesse `/admin`
- Selecione um pedido
- Clique em "Baixar"
- Verifique se o ZIP é criado e baixado

### **2. Teste de Múltiplas Imagens**
- Teste com pedido que tenha várias imagens
- Verifique se todas as imagens estão no ZIP
- Confirme estrutura do ZIP

### **3. Teste de Limpeza**
- Verifique se arquivos temporários são removidos
- Confirme que apenas o ZIP permanece em `/public/temp/`

## 🚀 Deploy

A funcionalidade está pronta para deploy no Cloud Run:

1. **Build da aplicação**: `npm run build`
2. **Deploy no Cloud Run**: Seguir instruções do `CLOUD-RUN-DEPLOY.md`
3. **Testar download**: Acessar admin e testar download de pedidos

## 🔍 Debug

### **Logs Importantes:**
- Verificar se `GCS_BUCKET_NAME` está configurado
- Confirmar conectividade com GCS
- Verificar permissões de leitura no bucket

### **Possíveis Problemas:**
- **Erro de credenciais**: Verificar configuração do GCS
- **Arquivo não encontrado**: Verificar se imagens existem no bucket
- **Erro de download**: Verificar permissões do bucket

## ✅ Status

- [x] Código refatorado para GCS
- [x] Função getStorage() implementada
- [x] Download do GCS implementado
- [x] Compilação testada
- [x] Funcionalidades mantidas
- [ ] Teste em produção (Cloud Run)
- [ ] Validação de download completo
