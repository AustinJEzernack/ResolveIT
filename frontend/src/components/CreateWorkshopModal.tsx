import React, { useState } from 'react'
import apiClient from '@services/api'
import '../styles/CreateWorkshopModal.css'

interface CreateWorkshopModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const CreateWorkshopModal: React.FC<CreateWorkshopModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logo_url: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await apiClient.post('/workshops/create/', {
        name: formData.name,
        description: formData.description,
        logo_url: formData.logo_url || null,
      })

      setFormData({ name: '', description: '', logo_url: '' })
      onSuccess()
      onClose()
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to create workshop'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Workshop</h2>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="workshop-form">
          <div className="form-group">
            <label htmlFor="name">Workshop Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter workshop name"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter workshop description (optional)"
              rows={4}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="logo_url">Logo URL</label>
            <input
              type="url"
              id="logo_url"
              name="logo_url"
              value={formData.logo_url}
              onChange={handleInputChange}
              placeholder="https://example.com/logo.png (optional)"
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Workshop'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateWorkshopModal
