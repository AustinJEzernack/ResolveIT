import React from 'react'
import { useNavigate } from 'react-router-dom'

interface WorkshopItemProps {
  id: string
  name: string
  description: string
  memberCount: number
}

const WorkshopItem: React.FC<WorkshopItemProps> = ({ id, name, description, memberCount }) => {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/workshop/${id}`)
  }

  return (
    <div className="workshop-item" onClick={handleClick}>
      <div className="workshop-info">
        <h4 className="workshop-name">{name}</h4>
        <p className="workshop-description">{description}</p>
      </div>
      <div className="workshop-meta">
        <span className="member-count">👥 {memberCount}</span>
      </div>
    </div>
  )
}

export default WorkshopItem
