# Deploy no Cloud Run - Configuração Completa

## ✅ Implementação Concluída

O código foi ajustado para usar Application Default Credentials no Cloud Run e credenciais do .env para desenvolvimento local.

## 🚀 Deploy no Cloud Run

### 1. **Configurar IAM para Cloud Run**

```bash
# Obter o número do projeto
PROJECT_ID="project-abda4253-0801-457c-81a"

# Dar permissão para o Cloud Run acessar o GCS
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/storage.objectViewer"

# Verificar se a permissão foi aplicada
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:$PROJECT_ID@appspot.gserviceaccount.com"
```

### 2. **Build e Deploy**

```bash
# Build da aplicação
npm run build

# Build da imagem Docker
gcloud builds submit --tag gcr.io/$PROJECT_ID/catalogo-interativo

# Deploy no Cloud Run
gcloud run deploy catalogo-interativo \
  --image gcr.io/$PROJECT_ID/catalogo-interativo \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GCS_BUCKET_NAME=bucket-catalogo-interativo,GCS_PROJECT_ID=$PROJECT_ID
```

### 3. **Verificar Deploy**

```bash
# Ver logs do Cloud Run
gcloud logs read --service=catalogo-interativo --limit=50

# Verificar se o serviço está rodando
gcloud run services list
```

## 🔧 Configuração Atual

### **Variáveis de Ambiente no Cloud Run:**
- `GCS_BUCKET_NAME=bucket-catalogo-interativo`
- `GCS_PROJECT_ID=project-abda4253-0801-457c-81a`

### **Detecção de Ambiente:**
- **Cloud Run**: Usa Application Default Credentials automaticamente
- **Local**: Usa credenciais do .env (se disponíveis) ou ADC

## 🧪 Teste Local (Opcional)

Para testar localmente, você precisa de uma chave privada válida:

1. **Baixar chave da Service Account** do Google Cloud Console
2. **Adicionar ao .env**:
```env
GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_AQUI\n-----END PRIVATE KEY-----\n"
```

3. **Ou usar gcloud auth** (se instalado):
```bash
gcloud auth application-default login
```

## 📋 Checklist de Deploy

- [x] Código ajustado para ADC no Cloud Run
- [x] Detecção de ambiente implementada
- [x] Logs de debug adicionados
- [ ] IAM configurado para Cloud Run
- [ ] Deploy executado
- [ ] Teste da aplicação no Cloud Run

## 🔍 Debug

Os logs mostrarão:
- Environment (development/production)
- Is Cloud Run (true/false)
- Bucket Name
- Project ID

## 🎯 Próximos Passos

1. Execute os comandos de IAM
2. Faça o deploy no Cloud Run
3. Teste a aplicação acessando a URL do Cloud Run
4. Verifique se as imagens carregam do GCS
